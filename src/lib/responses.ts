export function success(body: object): object {
    return buildResponse(200, body);
}

export function failure(body: object): object {
    return buildResponse(500, body);
}

export function notFound(body: object): object {
    return buildResponse(404, body);
}

export function redirect(location: string) {
    return {
        statusCode: 302,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
            Location: location,
         }
    }
}

function buildResponse(statusCode: number, body: object): object {
    return {
        statusCode: statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true
        },
        body: JSON.stringify(body)
    };
}