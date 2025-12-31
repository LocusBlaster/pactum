/**
 * @see https://pactumjs.github.io/api/recorder/setRecordMode.html
 */
export function setRecordMode(sessionName: string): void;

/**
 * @see https://pactumjs.github.io/api/recorder/setPlaybackMode.html
 */
export function setPlaybackMode(sessionName: string): void;

/**
 * @see https://pactumjs.github.io/api/recorder/setAutoMode.html
 */
export function setAutoMode(sessionName: string): void;

/**
 * @see https://pactumjs.github.io/api/recorder/stopRecording.html
 */
export function stopRecording(): void;

/**
 * @see https://pactumjs.github.io/api/recorder/clearRecordings.html
 */
export function clearRecordings(sessionName?: string): void;
