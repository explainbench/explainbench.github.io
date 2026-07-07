import process from "node:process";
import Hexo from "hexo";
import { prepareLeaderboardData } from "./fetch-leaderboard-data.mjs";

const hexo = new Hexo(process.cwd(), { _: ["generate"], config: "_config.yml" });
hexo.env.init = true;

try {
  await prepareLeaderboardData();
  await hexo.init();
  await hexo.call("clean", {});
  await hexo.call("generate", { bail: true, force: true });
  process.env.EXPLAINBENCH_SITE_URL = hexo.config.url || "";
  process.env.EXPLAINBENCH_SITE_ROOT = hexo.config.root || "/";
  await hexo.exit();
  await import("./postbuild.mjs");
} catch (error) {
  await hexo.exit(error);
  throw error;
}
