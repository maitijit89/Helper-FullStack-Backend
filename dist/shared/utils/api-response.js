"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResponse = void 0;
const sendResponse = (res, options) => {
    const { statusCode = 200, message, data, meta } = options;
    const payload = {
        success: statusCode >= 200 && statusCode < 300,
        statusCode,
        message,
        ...(data !== undefined && { data }),
        ...(meta !== undefined && { meta }),
    };
    return res.status(statusCode).json(payload);
};
exports.sendResponse = sendResponse;
//# sourceMappingURL=api-response.js.map