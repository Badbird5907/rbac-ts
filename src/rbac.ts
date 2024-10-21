import {
  isFunction,
  isPromise,
  isString,
  isGlob,
  globToRegex,
  checkRegex,
  defaultLogger,
  regexFromOperation,
  globsFromFoundedRole
} from './helpers';

// Types for role configuration and RBAC structure
type RoleConfig = {
  can: string | { name: string; when: any }[];
  inherits?: string[];
};

type MappedRole = {
  can: Record<string, boolean | ((params: unknown, callback: (err: Error | null, result: unknown) => void) => void) | Promise<boolean>>;
  inherits?: string[];
};

type Logger = (role: string, operation: string, result: boolean) => void;

type Config = {
  logger?: Logger;
  enableLogger: boolean;
};

// The `can` function type
const can = (config: Config = { logger: defaultLogger, enableLogger: true }) => (
  mappedRoles: Record<string, MappedRole>
) => (role: string, operation: string, params: unknown): Promise<boolean> =>
  new Promise((resolve, reject) => {
    const foundedRole = mappedRoles[role];
    const regexOperation = regexFromOperation(operation);
    const isGlobOperation = isGlob(operation);
    const matchOperationFromCan = foundedRole?.can[operation];

    const resolvePromise = (role: string, result: boolean) => {
      if (config.enableLogger) (config.logger || defaultLogger)(role, operation, result);
      return resolve(result);
    };

    if (isString(operation) && matchOperationFromCan === true) {
      return resolvePromise(role, true);
    }

    const resolveInherits = (inherits: string[] | undefined) =>
      inherits
        ? Promise.all(inherits.map((parent) => can({ enableLogger: false })(mappedRoles)(parent, operation, params)))
            .then((result) => resolvePromise(role, result.includes(true)))
            .catch(() => resolvePromise(role, false))
        : resolvePromise(role, false);

    const resolveResult = (result: boolean | unknown) =>
      result ? resolvePromise(role, Boolean(result)) : resolveInherits(foundedRole.inherits);

    const resolveWhen = (when: unknown) => {
      if (when === true) {
        return resolvePromise(role, true);
      }
      if (isPromise(when)) {
        return (when as Promise<boolean>)
          .then((result) => resolveResult(result))
          .catch(() => resolvePromise(role, false));
      }
      if (isFunction(when)) {
        return (when as (params: unknown, callback: (err: Error | null, result: unknown) => void) => void)(
          params,
          (err: Error | null, result: unknown) => {
            if (err) return reject(err);
            return resolveResult(result);
          }
        );
      }
      return resolvePromise(role, false);
    };

    if (regexOperation || isGlobOperation) {
      return resolvePromise(
        role,
        checkRegex(isGlobOperation ? globToRegex(operation) : regexOperation!, foundedRole.can)
      );
    }

    if (Object.keys(foundedRole.can).some(isGlob)) {
      const matchOperation = globsFromFoundedRole(foundedRole.can).find((x) => x.regex.test(operation));
      if (matchOperation) return resolveWhen(matchOperation.when);
    }

    if (!matchOperationFromCan) {
      if (!foundedRole.inherits) return resolvePromise(role, false);
      return resolveInherits(foundedRole.inherits);
    }

    return resolveWhen(matchOperationFromCan);
  });

// The `roleCanMap` function type
const roleCanMap = (roleCan: (string | { name: string; when: any })[]): Record<string, boolean | any> =>
  roleCan.reduce(
    (acc, operation) =>
      typeof operation === 'string'
        ? { ...acc, [operation]: true }
        : { ...acc, [operation.name]: operation.when },
    {}
  );

// The `mapRoles` function type
const mapRoles = (roles: Record<string, RoleConfig>): Record<string, MappedRole> => {
  return Object.entries(roles).reduce((acc, [roleName, roleValue]) => {
    return {
      ...acc,
      [roleName]: {
        can: roleCanMap(Array.isArray(roleValue.can) ? roleValue.can : [roleValue.can]),
        inherits: roleValue.inherits
      }
    };
  }, {} as Record<string, MappedRole>);
};

// The RBAC function type
const RBAC = (config: Config) => (roles: Record<string, RoleConfig>) => ({
  can: can(config)(mapRoles(roles))
});

export default RBAC;
