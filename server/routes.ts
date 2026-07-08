import { get, route } from "@remix-run/fetch-router/routes";

export const routes = route({
  home: get("/"),
});
