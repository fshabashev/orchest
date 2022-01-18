import React from "react";
import { Redirect, Route, Switch, useLocation } from "react-router-dom";
import { getOrderedRoutes, siteMap, toQueryString } from "./routingConfig";

const Routes = () => {
  let location = useLocation();

  return (
    <Switch>
      <Route exact path="/">
        <Redirect to={siteMap.projects.path} />
      </Route>
      {getOrderedRoutes().map((route) => {
        const { name, path, component, title } = route;
        const shouldBeExact = name !== "notFound"; // notFound uses * as a fallback, it cannot be exact
        return (
          <Route
            exact={shouldBeExact}
            key={`${path}-${location.search}`}
            path={path}
            render={() => {
              window.document.title = title;
              const Component = component;
              return <Component />;
            }}
          />
        );
      })}
      <Route path="*">
        <Redirect to={siteMap.projects.path} />
      </Route>
    </Switch>
  );
};

export { siteMap, Routes, toQueryString };
