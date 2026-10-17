import type { ChatQueryOptions, ChatRepository } from '../../ports/index.js';
import type { ChatMessage, Id } from '../../domain/types.js';
import type { Db } from './database.js';

interface Row {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

const toMessage = (r: Row): ChatMessage => ({
  id: r.id,
  projectId: r.project_id,
  authorId: r.author_id,
  body: r.body,
  createdAt: r.created_at,
});

export class SqliteChatRepository implements ChatRepository {
  constructor(private readonly db: Db) {}

  insert(m: ChatMessage): void {
    this.db
      .prepare('INSERT INTO chat_messages (id, project_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(m.id, m.projectId, m.authorId, m.body, m.createdAt);
  }

  /** Take the newest `limit` rows, then flip back to chronological order. */
  listByProject(projectId: Id, { since, limit }: ChatQueryOptions): ChatMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM (
           SELECT *, rowid AS seq FROM chat_messages
           WHERE project_id = @projectId AND (@since IS NULL OR created_at >= @since)
           ORDER BY created_at DESC, rowid DESC
           LIMIT @limit
         ) ORDER BY created_at, seq`,
      )
      .all({ projectId, since: since ?? null, limit }) as Row[];
    return rows.map(toMessage);
  }
}
