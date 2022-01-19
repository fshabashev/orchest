import { toQueryString } from "@/routingConfig";
import { openInNewTab } from "@/utils/openInNewTab";
import React from "react";
import { useHistory, useLocation } from "react-router-dom";

// NOTE: if the parameter is safe to expose to user (i.e. component can read it from the URL), use useLocationQuery
// For the data that we want to persist and we don't want to expose, use useLocationState

// const [email, mobile, isReadOnly] = useLocationState<[string, number, boolean]>(['email', 'mobile', 'isActive'])
// console.log(email); // 'john@email.com'
// console.log(mobile); // 0612345678
// console.log(isReadOnly); // true
const useLocationState = <T>(stateNames: string[]) => {
  const location = useLocation();
  return (stateNames.map((stateName) =>
    location.state ? location.state[stateName] : null
  ) as unknown) as T;
};

// see https://reactrouter.com/web/example/query-parameters
// e.g. https://example.com/user?foo=123&bar=abc
// const [foo, bar] = useLocationQuery(['foo', 'bar']);
// console.log(foo); // '123'
// console.log(bar); // 'abc'
// NOTE: the returned value is ALWAYS a string
const useLocationQuery = <T extends (string | boolean | null | undefined)[]>(
  queryStrings: string[]
): T => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  return queryStrings.map((str) => {
    const value = query.get(str);
    if (value === "undefined") return undefined;
    if (value === "null") return null;
    if (value === "true") return true;
    if (value === "false") return false;
    // NOTE: we don't handle numbers!
    return value;
  }) as T;
};

const useHistoryListener = <T>({
  forward,
  backward,
  onPush,
}: {
  forward?: (history) => void;
  backward?: (history) => void;
  onPush?: (history) => void;
}) => {
  const history = useHistory<T>();
  const locationKeysRef = React.useRef([]);
  React.useEffect(() => {
    const removeListener = history.listen((location) => {
      if (history.action === "PUSH") {
        locationKeysRef.current = [location.key];
        onPush && onPush(history);
      }
      if (history.action === "POP") {
        const isForward = locationKeysRef.current[1] === location.key;
        if (isForward) {
          forward && forward(history);
        } else {
          backward && backward(history);
        }

        // update location keys
        locationKeysRef.current =
          locationKeysRef.current[1] === location.key
            ? locationKeysRef.current.slice(1)
            : [location.key, ...locationKeysRef.current];
      }
    });
    return removeListener;
  }, []);
};

type Some<T> = T | undefined;
type Option<T> = Some<T> | null;

// these are common use cases that are all over the place
// if there are specific cases that you need to pass some querystrings or states
// better make use of useLocationQuery and useLocationState
const useCustomRoute = () => {
  const history = useHistory();

  const valueArray = useLocationQuery<
    [
      Option<string>,
      Option<string>,
      Option<string>,
      Option<string>,
      Option<string>,
      Option<string>,
      Option<string>,
      Option<boolean>
    ]
  >([
    "job_uuid",
    "run_uuid",
    "initial_tab",
    "project_uuid",
    "pipeline_uuid",
    "environment_uuid",
    "step_uuid",
    "readonly",
  ]);

  const [
    jobUuid,
    runUuid,
    initialTab,
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
    readonly,
  ] = valueArray;

  type NavigateParams = {
    query?: Record<string, string | number | boolean>;
    state?: Record<string, string | number | boolean | undefined | null>;
  };

  const navigateTo = React.useCallback(
    (
      path: string,
      params?: NavigateParams | undefined,
      e?: React.MouseEvent
    ) => {
      const [pathname, existingQueryString] = path.split("?");
      const { query = null, state = {} } = params || {};

      const shouldOpenNewTab = e?.ctrlKey || e?.metaKey;
      const queryString = existingQueryString
        ? `${existingQueryString}&${toQueryString(query)}`
        : toQueryString(query);

      if (shouldOpenNewTab) {
        openInNewTab(`${window.location.origin}${pathname}${queryString}`);
      } else {
        history.push({
          pathname,
          search: queryString,
          state,
        });
      }
    },
    [history]
  );

  /*
    queryArguments (from useLocationQuery) returned below are assumed
    to be static across the lifetime of mounted components.

    Therefore in Routes.tsx we enforce a component remount
    when the query string changes.

    For now we want to limit this assumption to just View components.
  */

  return {
    navigateTo,
    readonly,
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
    jobUuid,
    runUuid,
    initialTab,
  };
};

export {
  useLocationState,
  useLocationQuery,
  useHistoryListener,
  useCustomRoute,
};
