import process from "node:process";
import Hexo from "hexo";

const hexo = new Hexo(process.cwd(), { _: ["generate"], config: "_config.yml" });
hexo.env.init = true;

try {
  await hexo.init();
  await hexo.call("clean", {});
  await hexo.call("generate", { bail: true, force: true });
  await hexo.exit();
  await import("./postbuild.mjs");
} catch (error) {
  await hexo.exit(error);
  throw error;
}
