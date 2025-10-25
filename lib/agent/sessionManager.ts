import { Session, SessionPreview, Turn } from '@/types/session';
import { CanvasObject, Subject } from '@/types/canvas';
import { generateSessionId, generateTurnId } from '@/lib/utils/ids';
import { NotFoundError } from '@/lib/utils/errors';
import { logger } from '@/lib/utils/logger';

class SessionManager {
  private sessions: Map<string, Session> = new Map();

  createSession(subject: Subject, title?: string): Session {
    const sessionId = generateSessionId();
    const now = Date.now();

    const session: Session = {
      id: sessionId,
      title: title || `${subject.charAt(0).toUpperCase() + subject.slice(1)} Session`,
      subject,
      createdAt: now,
      updatedAt: now,
      turns: [],
      canvasObjects: [],
    };

    this.sessions.set(sessionId, session);
    logger.info(`Created session: ${sessionId}`);

    return session;
  }

  getSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError(`Session not found: ${sessionId}`);
    }
    return session;
  }

  getAllSessions(): SessionPreview[] {
    return Array.from(this.sessions.values())
      .map(session => ({
        id: session.id,
        title: session.title,
        subject: session.subject,
        updatedAt: session.updatedAt,
        preview: session.turns.length > 0
          ? session.turns[0].content.substring(0, 100)
          : 'No messages yet',
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  addTurn(sessionId: string, turn: Omit<Turn, 'id'>): Turn {
    const session = this.getSession(sessionId);

    const newTurn: Turn = {
      id: generateTurnId(),
      ...turn,
    };

    session.turns.push(newTurn);
    session.updatedAt = Date.now();

    logger.info(`Added turn to session ${sessionId}: ${newTurn.id}`);

    return newTurn;
  }

  addCanvasObject(sessionId: string, object: CanvasObject): void {
    const session = this.getSession(sessionId);
    session.canvasObjects.push(object);
    session.updatedAt = Date.now();

    logger.info(`Added canvas object to session ${sessionId}: ${object.id}`);
  }

  addCanvasObjects(sessionId: string, objects: CanvasObject[]): void {
    const session = this.getSession(sessionId);
    session.canvasObjects.push(...objects);
    session.updatedAt = Date.now();

    logger.info(`Added ${objects.length} canvas objects to session ${sessionId}`);
  }

  getCanvasObject(sessionId: string, objectId: string): CanvasObject | undefined {
    const session = this.getSession(sessionId);
    return session.canvasObjects.find(obj => obj.id === objectId);
  }

  getCanvasObjects(sessionId: string, objectIds: string[]): CanvasObject[] {
    const session = this.getSession(sessionId);
    return session.canvasObjects.filter(obj => objectIds.includes(obj.id));
  }

  getRecentTurns(sessionId: string, limit: number = 10): Turn[] {
    const session = this.getSession(sessionId);
    return session.turns.slice(-limit);
  }

  updateSessionTitle(sessionId: string, title: string): void {
    const session = this.getSession(sessionId);
    session.title = title;
    session.updatedAt = Date.now();
  }

  deleteSession(sessionId: string): void {
    const deleted = this.sessions.delete(sessionId);
    if (!deleted) {
      throw new NotFoundError(`Session not found: ${sessionId}`);
    }
    logger.info(`Deleted session: ${sessionId}`);
  }
}

export const sessionManager = new SessionManager();
