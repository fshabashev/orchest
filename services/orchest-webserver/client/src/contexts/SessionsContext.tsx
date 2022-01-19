import { useAppContext } from "@/contexts/AppContext";
import type { IOrchestSession, IOrchestSessionUuid } from "@/types";
import { fetcher } from "@/utils/fetcher";
import { hasValue, HEADER } from "@orchest/lib-utils";
import pascalcase from "pascalcase";
import React from "react";

type TSessionStatus = IOrchestSession["status"];

const ENDPOINT = "/catch/api-proxy/api/sessions/";

/* Util functions
  =========================================== */

const lowerCaseFirstLetter = (str: string) =>
  str.charAt(0).toLowerCase() + str.slice(1);

function convertKeyToCamelCase<T>(data: T | undefined, keys?: string[]) {
  if (!data) return data;
  if (keys) {
    for (const key of keys) {
      data[lowerCaseFirstLetter(pascalcase(key))] = data[key];
    }
    return data as T;
  }
  return Object.entries(data).reduce((newData, curr) => {
    const [key, value] = curr;
    return {
      ...newData,
      [lowerCaseFirstLetter(pascalcase(key))]: value,
    };
  }, {}) as T;
}

type Session = {
  project_uuid?: string;
  pipeline_uuid?: string;
  projectUuid?: string;
  pipelineUuid?: string;
};

const getSessionValue = (session: Session | null) => {
  return (
    session && {
      projectUuid: session.projectUuid || session.project_uuid,
      pipelineUuid: session.pipelineUuid || session.pipeline_uuid,
    }
  );
};

// because project_uuid and pipeline_uuid can either be snake_case or camelCase,
// isSession function should be able to compare either case.
export const isSession = (a: Session, b: Session) => {
  if (!a || !b) return false;
  const sessionA = getSessionValue(a);
  const sessionB = getSessionValue(b);

  return !Object.keys(sessionA).some((key) => sessionA[key] !== sessionB[key]);
};

/* Matchers
  =========================================== */

const isStoppable = (status: TSessionStatus) =>
  ["RUNNING", "LAUNCHING"].includes(status);

/* Fetchers
  =========================================== */

const stopSession = ({ pipelineUuid, projectUuid }: IOrchestSessionUuid) =>
  fetcher(`${ENDPOINT}${projectUuid}/${pipelineUuid}`, {
    method: "DELETE",
  });

/**
 *
 * Context
 */

type SessionsContextState = {
  sessions?: IOrchestSession[];
  sessionsIsLoading?: boolean;
  sessionsKillAllInProgress?: boolean;
};

type Action =
  | {
      type: "SET_SESSIONS";
      payload: Pick<SessionsContextState, "sessions"> & {
        sessionsIsLoading?: boolean;
      };
    }
  | { type: "SET_IS_KILLING_ALL_SESSIONS"; payload: boolean };

type ActionCallback = (previousState: SessionsContextState) => Action;

type SessionsContextAction = Action | ActionCallback;

type SessionsContext = {
  state: SessionsContextState;
  dispatch: React.Dispatch<SessionsContextAction>;
  getSession: (
    session: Pick<IOrchestSession, "pipelineUuid" | "projectUuid">
  ) => IOrchestSession | undefined;
  toggleSession: (payload: IOrchestSessionUuid) => Promise<void>;
  deleteAllSessions: () => Promise<void>;
};

const Context = React.createContext<SessionsContext | null>(null);
export const useSessionsContext = () =>
  React.useContext(Context) as SessionsContext;

const reducer = (
  state: SessionsContextState,
  _action: SessionsContextAction
) => {
  const action = _action instanceof Function ? _action(state) : _action;

  if (process.env.NODE_ENV === "development")
    console.log("(Dev Mode) useUserContext: action ", action);
  switch (action.type) {
    case "SET_SESSIONS": {
      const { sessionsIsLoading, sessions } = action.payload;

      return {
        ...state,
        sessions,
        sessionsIsLoading: hasValue(sessionsIsLoading)
          ? sessionsIsLoading
          : state.sessionsIsLoading,
      };
    }
    case "SET_IS_KILLING_ALL_SESSIONS":
      return { ...state, sessionsKillAllInProgress: action.payload };

    default: {
      console.error(action);
      return state;
    }
  }
};

const initialState: SessionsContextState = {
  sessions: [],
  sessionsIsLoading: true,
  sessionsKillAllInProgress: false,
};

/* Provider
  =========================================== */

export const SessionsContextProvider: React.FC = ({ children }) => {
  const { setAlert } = useAppContext();

  const [state, dispatch] = React.useReducer(reducer, initialState);

  const getSession = React.useCallback(
    (session: Pick<IOrchestSession, "pipelineUuid" | "projectUuid">) =>
      state.sessions.find((stateSession) => isSession(session, stateSession)),
    [state]
  );

  /**
   * a wrapper of SET_SESSIONS action dispatcher, used for updating single session
   */
  const setSession = React.useCallback(
    (newSessionData?: Partial<IOrchestSession>) => {
      if (!newSessionData) return;
      dispatch((currentState) => {
        let found = false;
        const newSessions = currentState.sessions.map((sessionData) => {
          const isMatching = isSession(newSessionData, sessionData);
          if (isMatching) found = true;

          return isMatching
            ? { ...sessionData, ...newSessionData }
            : sessionData;
        });

        // not found, insert newSessionData as the temporary session
        const outcome = (found
          ? newSessions
          : [
              ...newSessions,
              { ...newSessionData, status: "LAUNCHING" },
            ]) as IOrchestSession[];

        return {
          type: "SET_SESSIONS",
          payload: {
            sessions: outcome,
          },
        };
      });
    },
    [dispatch]
  );

  // NOTE: launch/delete session is an async operation from BE
  // the caller of toggleSession MUST also have useSessionsPoller
  const toggleSession = React.useCallback(
    async (payload: IOrchestSessionUuid) => {
      const foundSession = state.sessions.find((session) =>
        isSession(session, payload)
      );

      /* use the cashed session from useSWR or create a temporary one out of previous one */
      const session = convertKeyToCamelCase<IOrchestSession>(foundSession, [
        "project_uuid",
        "pipeline_uuid",
      ]);

      const isWorking = ["LAUNCHING", "STOPPING"].includes(session?.status);
      if (isWorking) return;

      // both "RUNNING", "LAUNCHING" are stoppable
      // but we only allow RUNNING to be stopped here
      if (session?.status === "RUNNING") {
        setSession({ ...session, status: "STOPPING" });
        try {
          await stopSession(session);
        } catch (error) {
          setAlert("Error", "Failed to stop session.");
          console.error(error);
        }
        return;
      }

      // session is undefined, launching a new session
      setSession({ ...payload, status: "LAUNCHING" });
      await fetcher(ENDPOINT, {
        method: "POST",
        headers: HEADER.JSON,
        body: JSON.stringify({
          pipeline_uuid: payload.pipelineUuid,
          project_uuid: payload.projectUuid,
        }),
      })
        .then((sessionDetails) => setSession(sessionDetails))
        .catch((err) => {
          if (err?.message) {
            setAlert(
              "Error",
              `Error while starting the session: ${err.message}`
            );
          }

          console.error(err);
        });
    },
    [setAlert, setSession, state]
  );

  const deleteAllSessions = React.useCallback(async () => {
    dispatch({ type: "SET_IS_KILLING_ALL_SESSIONS", payload: true });
    let sessionsToStop: { projectUuid: string; pipelineUuid: string }[] = [];
    dispatch((currentState) => {
      const newSessions = currentState.sessions.map((sessionValue) => {
        const shouldStop = isStoppable(sessionValue.status);

        if (shouldStop) {
          const { projectUuid, pipelineUuid } = sessionValue;
          sessionsToStop.push({ projectUuid, pipelineUuid });
        }
        return {
          ...sessionValue,
          status: shouldStop ? "STOPPING" : sessionValue.status,
        };
      });

      return {
        type: "SET_SESSIONS",
        payload: { sessions: newSessions },
      };
    });

    await Promise.all(
      sessionsToStop.map((sessionToStop) => stopSession(sessionToStop))
    )
      .then(() => {
        dispatch({ type: "SET_SESSIONS", payload: { sessions: [] } });
        dispatch({ type: "SET_IS_KILLING_ALL_SESSIONS", payload: false });
      })
      .catch((err) => {
        console.error("Unable to stop all sessions", err);
      });
  }, [dispatch]);

  return (
    <Context.Provider
      value={{
        state,
        dispatch,
        getSession,
        toggleSession,
        deleteAllSessions,
      }}
    >
      {children}
    </Context.Provider>
  );
};
