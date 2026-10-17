/**
 * The application facade: binds every command and query handler to a concrete set of ports.
 *
 * Adapters (HTTP, MCP, a future CLI, ...) receive a `Camp` and call `camp.commands.x(input)` or
 * `camp.queries.y(input)`. They never touch repositories directly, which is what keeps business
 * rules in exactly one place.
 */
import type { CampDeps } from '../ports/index.js';

import { addComment } from './commands/addComment.js';
import { addProjectMember } from './commands/addProjectMember.js';
import { createDoc } from './commands/createDoc.js';
import { createEvent } from './commands/createEvent.js';
import { createPost } from './commands/createPost.js';
import { createProject } from './commands/createProject.js';
import { createTodo } from './commands/createTodo.js';
import { createTodoList } from './commands/createTodoList.js';
import { deleteComment } from './commands/deleteComment.js';
import { deleteDoc } from './commands/deleteDoc.js';
import { deleteEvent } from './commands/deleteEvent.js';
import { deletePost } from './commands/deletePost.js';
import { deleteProject } from './commands/deleteProject.js';
import { deleteTodo } from './commands/deleteTodo.js';
import { deleteTodoList } from './commands/deleteTodoList.js';
import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { postChatMessage } from './commands/postChatMessage.js';
import { registerUser } from './commands/registerUser.js';
import { removeProjectMember } from './commands/removeProjectMember.js';
import { setTodoCompletion } from './commands/setTodoCompletion.js';
import { updateDoc } from './commands/updateDoc.js';
import { updateEvent } from './commands/updateEvent.js';
import { updatePost } from './commands/updatePost.js';
import { updateProject } from './commands/updateProject.js';
import { updateTodo } from './commands/updateTodo.js';
import { updateTodoList } from './commands/updateTodoList.js';
import { getCurrentUser } from './queries/getCurrentUser.js';
import { getDoc } from './queries/getDoc.js';
import { getEvent } from './queries/getEvent.js';
import { getPost } from './queries/getPost.js';
import { getProject } from './queries/getProject.js';
import { getTodo } from './queries/getTodo.js';
import { listChatMessages } from './queries/listChatMessages.js';
import { listDocs } from './queries/listDocs.js';
import { listEvents } from './queries/listEvents.js';
import { listPosts } from './queries/listPosts.js';
import { listProjects } from './queries/listProjects.js';
import { listTodoLists } from './queries/listTodoLists.js';
import { listUsers } from './queries/listUsers.js';

type Handler<I, O> = (deps: CampDeps, input: I) => O;
const bind =
  <I, O>(deps: CampDeps, handler: Handler<I, O>) =>
  (input: I): O =>
    handler(deps, input);

export function createCamp(deps: CampDeps) {
  return {
    /** Writes. Each validates its input and mutates state. */
    commands: {
      addComment: bind(deps, addComment),
      addProjectMember: bind(deps, addProjectMember),
      createDoc: bind(deps, createDoc),
      createEvent: bind(deps, createEvent),
      createPost: bind(deps, createPost),
      createProject: bind(deps, createProject),
      createTodo: bind(deps, createTodo),
      createTodoList: bind(deps, createTodoList),
      deleteComment: bind(deps, deleteComment),
      deleteDoc: bind(deps, deleteDoc),
      deleteEvent: bind(deps, deleteEvent),
      deletePost: bind(deps, deletePost),
      deleteProject: bind(deps, deleteProject),
      deleteTodo: bind(deps, deleteTodo),
      deleteTodoList: bind(deps, deleteTodoList),
      login: bind(deps, login),
      logout: bind(deps, logout),
      postChatMessage: bind(deps, postChatMessage),
      registerUser: bind(deps, registerUser),
      removeProjectMember: bind(deps, removeProjectMember),
      setTodoCompletion: bind(deps, setTodoCompletion),
      updateDoc: bind(deps, updateDoc),
      updateEvent: bind(deps, updateEvent),
      updatePost: bind(deps, updatePost),
      updateProject: bind(deps, updateProject),
      updateTodo: bind(deps, updateTodo),
      updateTodoList: bind(deps, updateTodoList),
    },
    /** Reads. Side-effect free, each shaped for a specific view. */
    queries: {
      getCurrentUser: bind(deps, getCurrentUser),
      getDoc: bind(deps, getDoc),
      getEvent: bind(deps, getEvent),
      getPost: bind(deps, getPost),
      getProject: bind(deps, getProject),
      getTodo: bind(deps, getTodo),
      listChatMessages: bind(deps, listChatMessages),
      listDocs: bind(deps, listDocs),
      listEvents: bind(deps, listEvents),
      listPosts: bind(deps, listPosts),
      listProjects: bind(deps, listProjects),
      listTodoLists: bind(deps, listTodoLists),
      listUsers: bind(deps, listUsers),
    },
  };
}

export type Camp = ReturnType<typeof createCamp>;
export type CampCommands = Camp['commands'];
export type CampQueries = Camp['queries'];

export * from './result.js';
export type * from './types.js';
export type * from './views.js';

export type * from './commands/addComment.js';
export type * from './commands/addProjectMember.js';
export type * from './commands/createDoc.js';
export type * from './commands/createEvent.js';
export type * from './commands/createPost.js';
export type * from './commands/createProject.js';
export type * from './commands/createTodo.js';
export type * from './commands/createTodoList.js';
export type * from './commands/deleteComment.js';
export type * from './commands/deleteDoc.js';
export type * from './commands/deleteEvent.js';
export type * from './commands/deletePost.js';
export type * from './commands/deleteProject.js';
export type * from './commands/deleteTodo.js';
export type * from './commands/deleteTodoList.js';
export type * from './commands/login.js';
export type * from './commands/logout.js';
export type * from './commands/postChatMessage.js';
export type * from './commands/registerUser.js';
export type * from './commands/removeProjectMember.js';
export type * from './commands/setTodoCompletion.js';
export type * from './commands/updateDoc.js';
export type * from './commands/updateEvent.js';
export type * from './commands/updatePost.js';
export type * from './commands/updateProject.js';
export type * from './commands/updateTodo.js';
export type * from './commands/updateTodoList.js';
export type * from './queries/getCurrentUser.js';
export type * from './queries/getDoc.js';
export type * from './queries/getEvent.js';
export type * from './queries/getPost.js';
export type * from './queries/getProject.js';
export type * from './queries/getTodo.js';
export type * from './queries/listChatMessages.js';
export type * from './queries/listDocs.js';
export type * from './queries/listEvents.js';
export type * from './queries/listPosts.js';
export type * from './queries/listProjects.js';
export type * from './queries/listTodoLists.js';
export type * from './queries/listUsers.js';
