import { useInterval } from "@/hooks/use-interval";
import { Routes } from "@/Routes";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { makeRequest } from "@orchest/lib-utils";
import $ from "jquery";
import React, { useRef } from "react";
import { BrowserRouter as Router, Prompt } from "react-router-dom";
import { useIntercom } from "react-use-intercom";
import BuildPendingDialog from "./components/BuildPendingDialog";
import CommandPalette from "./components/CommandPalette";
import HeaderBar from "./components/HeaderBar";
import { OnboardingDialog } from "./components/Layout/OnboardingDialog";
import { AppDrawer } from "./components/MainDrawer";
import { SystemDialog } from "./components/SystemDialog";
import { useAppContext } from "./contexts/AppContext";
import { useLocalStorage } from "./hooks/useLocalStorage";
import Jupyter from "./jupyter/Jupyter";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
$.fn.overflowing = function () {
  let overflowed = false;

  this.each(function () {
    let el = $(this)[0];

    if (el.offsetHeight < el.scrollHeight || el.offsetWidth < el.scrollWidth) {
      overflowed = true;
    } else {
      overflowed = false;
    }
  });

  return overflowed;
};

window.$ = $;

const App = () => {
  const [jupyter, setJupyter] = React.useState(null);
  const { boot } = useIntercom();
  const [isDrawerOpen, setIsDrawerOpen] = useLocalStorage("drawer", true);
  const { setConfirm } = useAppContext();

  const toggleDrawer = () => setIsDrawerOpen((currentValue) => !currentValue);

  // load server side config populated by flask template
  const {
    state: { config, user_config, hasUnsavedChanges },
    setAsSaved,
  } = useAppContext();

  const jupyterRef = useRef(null);

  // Each client provides an heartbeat, used for telemetry and idle
  // checking.
  useInterval(() => {
    makeRequest("GET", "/heartbeat");
  }, 5000);

  React.useEffect(() => {
    if (!user_config || !config) return;

    if (config.FLASK_ENV === "development") {
      console.log("Orchest is running with --dev.");
    }

    if (config.CLOUD === true) {
      console.log("Orchest is running with --cloud.");

      boot({
        email: user_config.INTERCOM_USER_EMAIL,
        createdAt: config.INTERCOM_DEFAULT_SIGNUP_DATE,
      });
    }
  }, [config, user_config]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    setJupyter(new Jupyter(jupyterRef.current, setConfirm));
  }, []);

  window.orchest = {
    jupyter,
  };

  return (
    <Router
      getUserConfirmation={(message, callback) => {
        // use Prompt component to intercept route changes
        // handle the blocking event here
        if (message === "hasUnsavedChanges") {
          setConfirm(
            "Warning",
            "There are unsaved changes. Are you sure you want to navigate away?",
            async (resolve) => {
              setAsSaved();
              callback(true);
              resolve(true);
              return true;
            }
          );
        }
      }}
    >
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <HeaderBar toggleDrawer={toggleDrawer} isDrawerOpen={isDrawerOpen} />
        <AppDrawer isOpen={isDrawerOpen} />
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: "hidden",
            position: "relative",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
          id="main-content"
          data-test-id="app"
        >
          <Toolbar />
          <Box sx={{ overflowY: "auto", flex: 1 }}>
            <Routes />
            <div ref={jupyterRef} className="persistent-view jupyter hidden" />
          </Box>
        </Box>
      </Box>
      <Prompt when={hasUnsavedChanges} message="hasUnsavedChanges" />
      <SystemDialog />
      <BuildPendingDialog />
      <OnboardingDialog />
      <CommandPalette />
    </Router>
  );
};

export default App;
