/** Browser shim for Expo Font's server-only AsyncLocalStorage import. */
export class AsyncLocalStorage<T> {
  getStore(): T | undefined {
    return undefined;
  }

  run<R>(_store: T, callback: (...args: never[]) => R): R {
    return callback();
  }
}
