export class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

export function asyncHandler(
    fn: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>,
) {
    return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
        fn(req, res, next).catch(next);
    };
}
