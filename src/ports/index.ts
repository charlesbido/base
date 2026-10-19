export type { Clock } from './Clock.js';
export type { IdGenerator } from './IdGenerator.js';
export type { TokenGenerator } from './TokenGenerator.js';
export type { PasswordHasher } from './PasswordHasher.js';
export type { UserRepository } from './UserRepository.js';
export type { SessionRepository } from './SessionRepository.js';
export type { AccessTokenRepository } from './AccessTokenRepository.js';
export type { ProjectRepository } from './ProjectRepository.js';
export type { TodoRepository } from './TodoRepository.js';
export type { CommentRepository } from './CommentRepository.js';
export type { PostRepository } from './PostRepository.js';
export type { DocRepository } from './DocRepository.js';
export type { ScheduleRepository, EventRange } from './ScheduleRepository.js';
export type { ChatRepository, ChatQueryOptions } from './ChatRepository.js';

import type { Clock } from './Clock.js';
import type { IdGenerator } from './IdGenerator.js';
import type { TokenGenerator } from './TokenGenerator.js';
import type { PasswordHasher } from './PasswordHasher.js';
import type { UserRepository } from './UserRepository.js';
import type { SessionRepository } from './SessionRepository.js';
import type { AccessTokenRepository } from './AccessTokenRepository.js';
import type { ProjectRepository } from './ProjectRepository.js';
import type { TodoRepository } from './TodoRepository.js';
import type { CommentRepository } from './CommentRepository.js';
import type { PostRepository } from './PostRepository.js';
import type { DocRepository } from './DocRepository.js';
import type { ScheduleRepository } from './ScheduleRepository.js';
import type { ChatRepository } from './ChatRepository.js';

/**
 * Everything the domain layer may depend on. Each handler declares the narrow subset it needs
 * via `Pick<CampDeps, ...>`, so tests only have to supply what is actually used.
 */
export interface CampDeps {
  users: UserRepository;
  sessions: SessionRepository;
  accessTokens: AccessTokenRepository;
  projects: ProjectRepository;
  todos: TodoRepository;
  comments: CommentRepository;
  posts: PostRepository;
  docs: DocRepository;
  schedule: ScheduleRepository;
  chat: ChatRepository;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
  passwords: PasswordHasher;
}
