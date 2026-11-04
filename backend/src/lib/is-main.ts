import { pathToFileURL } from 'node:url';

/**
 * 判断当前模块是否被直接执行（用于 CLI 脚本兼具库与入口两种身份）。
 * 编译前后文件后缀不同（.ts / .js），因此只比较绝对路径而非文件名。
 */
export function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return moduleUrl === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}
