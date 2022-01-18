import { useSessionsContext } from "@/contexts/SessionsContext";
import StyledButtonOutlined from "@/styled-components/StyledButton";
import { IOrchestSession } from "@/types";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import classNames from "classnames";
import React from "react";

export type TSessionToggleButtonRef = HTMLButtonElement;
type ISessionToggleButtonProps = {
  status?: IOrchestSession["status"] | "";
  pipelineUuid: string;
  projectUuid: string;
  isSwitch?: boolean;
  className?: string;
};

const SessionToggleButton = (props: ISessionToggleButtonProps) => {
  const { state, getSession, toggleSession } = useSessionsContext();

  const { className, isSwitch, pipelineUuid, projectUuid } = props;

  const status =
    props.status ||
    getSession({
      pipelineUuid,
      projectUuid,
    })?.status;

  const disabled =
    state.sessionsIsLoading || ["STOPPING", "LAUNCHING"].includes(status);
  const label =
    {
      STOPPING: "Session stopping…",
      LAUNCHING: "Session starting…",
      RUNNING: "Stop session",
    }[status] || "Start session";

  const handleEvent = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSession({ pipelineUuid, projectUuid });
  };
  const isSessionAlive = status === "RUNNING";

  return (
    <>
      {isSwitch ? (
        <FormControlLabel
          onClick={handleEvent}
          disableTypography
          control={
            <Switch
              disabled={disabled}
              size="small"
              inputProps={{
                "aria-label": `Switch ${isSessionAlive ? "off" : "on"} session`,
              }}
              sx={{ margin: (theme) => theme.spacing(0, 1) }}
              className={className}
              checked={isSessionAlive}
            />
          }
          label={label}
        />
      ) : (
        <StyledButtonOutlined
          variant="outlined"
          color="secondary"
          disabled={disabled}
          onClick={handleEvent}
          className={classNames(
            className,
            ["LAUNCHING", "STOPPING"].includes(status) ? "working" : "active"
          )}
          startIcon={isSessionAlive ? <StopIcon /> : <PlayArrowIcon />}
          data-test-id="session-toggle-button"
        >
          {label}
        </StyledButtonOutlined>
      )}
    </>
  );
};

export default SessionToggleButton;
