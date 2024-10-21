const is = (value: unknown, expected: string): boolean =>
  !!value && Object.prototype.toString.call(value) === expected;

const isRegex = (value: unknown): value is RegExp => value instanceof RegExp;

export const isGlob = (value: unknown): boolean => typeof value === 'string' && value.includes('*');
export const isPromise = (value: unknown): value is Promise<unknown> => is(value, '[object Promise]');
export const isFunction = (value: unknown): value is Function => is(value, '[object Function]');
export const isString = (value: unknown): value is string => is(value, '[object String]');

const globPatterns: Record<string, string> = {
  '*': '([^/]+)',
  '**': '(.+/)?([^/]+)',
  '**/': '(.+/)?'
};

const replaceGlobToRegex = (glob: string): string => glob
  .replace(/\./g, '\\.')
  .replace(/\*\*$/g, '(.+)')
  .replace(/(?:\*\*\/|\*\*|\*)/g, (str) => globPatterns[str]);

const joinGlobs = (globs: string[]): string => '((' + globs.map(replaceGlobToRegex).join(')|(') + '))';

const arraySequence = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

export const defaultLogger = (role: string, operation: string, result: boolean | string): void => {
  const fResult = result ? `${result}` : `${result}`;
  const fRole = `${role}`;
  const fOperation = `${operation}`;
  const rbacname = 'RBAC';
  console.log(` ${rbacname} ROLE: [${fRole}] OPERATION: [${fOperation}] PERMISSION: [${fResult}]`);
};

export const regexFromOperation = (value: string | RegExp): RegExp | null => {
  if (isRegex(value)) return value;
  try {
    const flags = value.replace(/.*\/([gimy]*)$/, '$1');
    const pattern = value.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
    const regex = new RegExp(pattern, flags);
    return regex;
  } catch (e) {
    return null;
  }
};

export const globToRegex = (glob: string | string[]): RegExp =>
  new RegExp('^' + (Array.isArray(glob) ? joinGlobs(glob) : replaceGlobToRegex(glob)) + '$');

export const checkRegex = (regex: RegExp, can: Record<string, unknown>): boolean =>
  Object.keys(can).some(operation => regex.test(operation));

export const globsFromFoundedRole = (can: Record<string, unknown>): Array<{ role: string, regex: RegExp, when: unknown }> =>
  Object.keys(can).map(role => isGlob(role) && {
    role,
    regex: globToRegex(role),
    when: can[role]
  }).filter(Boolean) as Array<{ role: string, regex: RegExp, when: unknown }>;
