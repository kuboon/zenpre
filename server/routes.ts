import { get, patch, post, route } from "@remix-run/fetch-router/routes";

export const routes = route({
  home: get("/"),
  slidePage: get("/s/:slide_id"),
  talkPage: get("/t/:talk_id"),
  talkPresent: get("/t/:talk_id/present"),
  api: route("api", {
    slidesCreate: post("/slides"),
    slideGet: get("/slides/:slide_id"),
    slideUpdate: patch("/slides/:slide_id"),
    talksCreate: post("/talks"),
    talkGet: get("/talks/:talk_id"),
  }),
});
