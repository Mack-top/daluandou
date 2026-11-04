// 把非 TS 资源（SQL）复制到编译产物目录，保证 `npm start` 也能读到 schema.sql
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(root, 'dist', 'db'), { recursive: true });
copyFileSync(path.join(root, 'src', 'db', 'schema.sql'), path.join(root, 'dist', 'db', 'schema.sql'));
console.log('[build] schema.sql 已复制到 dist/db/');
