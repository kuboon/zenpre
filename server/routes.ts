import { get, patch, post, put, route } from "@remix-run/fetch-router/routes";

export const routes = route({
  home: get("/"),
  slidePage: get("/s/:slide_id"),
  talkPage: get("/t/:talk_id"),
  talkPresent: get("/t/:talk_id/present"),
  talkReplay: get("/t/:talk_id/replay"),
  api: route("api", {
    slidesCreate: post("/slides"),
    slideGet: get("/slides/:slide_id"),
    slideUpdate: patch("/slides/:slide_id"),
    talksCreate: post("/talks"),
    talkGet: get("/talks/:talk_id"),
    timelinePut: put("/talks/:talk_id/timeline"),
    timelineGet: get("/talks/:talk_id/timeline"),
  }),
});
