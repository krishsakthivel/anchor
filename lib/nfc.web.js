const unsupported = () => { throw new Error('NFC check-ins need the installed Anchor phone app.'); };

export const writeLocationTag = unsupported;
export const readLocationTag = unsupported;
