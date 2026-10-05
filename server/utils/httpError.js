// Throw from a handler to answer with a specific status: throw new HttpError(404, 'Product not found')
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
