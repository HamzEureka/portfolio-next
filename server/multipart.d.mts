export function parseMultipart(body: Buffer, contentType: string | undefined): { name: string; filename: string | null; contentType: string; data: Buffer }[] | null;
