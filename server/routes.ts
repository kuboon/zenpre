import { get, patch, post, route } from "@remix-run/fetch-router/routes";

export const routes = route({
  home: get("/"),
  slidePage: get("/s/:slide_id"),
  api: route("api", {
    slidesCreate: post("/slides"),
    slideGet: get("/slides/:slide_id"),
    slideUpdate: patch("/slides/:slide_id"),
  }),
});
