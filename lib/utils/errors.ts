export class MentoraError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'MentoraError';
  }
}

export class ValidationError extends MentoraError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends MentoraError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ExternalServiceError extends MentoraError {
  constructor(message: string, public service: string) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
  }
}

export class InternalError extends MentoraError {
  constructor(message: string) {
    super(message, 500, 'INTERNAL_ERROR');
    this.name = 'InternalError';
  }
}

export function handleError(error: unknown): { message: string; statusCode: number; code?: string } {
  if (error instanceof MentoraError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
      code: 'UNKNOWN_ERROR',
    };
  }

  return {
    message: 'An unexpected error occurred',
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
  };
}
