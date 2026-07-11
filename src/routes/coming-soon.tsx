import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonView } from "../components/coming-soon-view";

export const Route = createFileRoute("/coming-soon")({
  head: () => ({
    meta: [
      { title: "Coming Soon — Pine Broker Admin" },
    ],
  }),
  component: ComingSoonView,
});
