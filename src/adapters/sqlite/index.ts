import type { CampDeps } from '../../ports/index.js';
import type { Db } from './database.js';
import { SqliteAccessTokenRepository } from './SqliteAccessTokenRepository.js';
import { SqliteChatRepository } from './SqliteChatRepository.js';
import { SqliteCommentRepository } from './SqliteCommentRepository.js';
import { SqliteDocRepository } from './SqliteDocRepository.js';
import { SqlitePostRepository } from './SqlitePostRepository.js';
import { SqliteProjectRepository } from './SqliteProjectRepository.js';
import { SqliteScheduleRepository } from './SqliteScheduleRepository.js';
import { SqliteSessionRepository } from './SqliteSessionRepository.js';
import { SqliteTodoRepository } from './SqliteTodoRepository.js';
import { SqliteUserRepository } from './SqliteUserRepository.js';

export { openDatabase, migrate, type Db } from './database.js';

export type SqliteRepositories = Pick<
  CampDeps,
  'users' | 'sessions' | 'accessTokens' | 'projects' | 'todos' | 'comments' | 'posts' | 'docs' | 'schedule' | 'chat'
>;

/** Every repository port, backed by one SQLite database. */
export function sqliteRepositories(db: Db): SqliteRepositories {
  return {
    users: new SqliteUserRepository(db),
    sessions: new SqliteSessionRepository(db),
    accessTokens: new SqliteAccessTokenRepository(db),
    projects: new SqliteProjectRepository(db),
    todos: new SqliteTodoRepository(db),
    comments: new SqliteCommentRepository(db),
    posts: new SqlitePostRepository(db),
    docs: new SqliteDocRepository(db),
    schedule: new SqliteScheduleRepository(db),
    chat: new SqliteChatRepository(db),
  };
}
