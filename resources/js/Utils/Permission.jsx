import { useAuthorization } from "./authorization";

export default function hasAnyPermission(permissions, givenPermissions = null) {
    const { canAny, isSuperAdmin } = useAuthorization();

    if (givenPermissions) {
        const permissionMap = Array.isArray(givenPermissions)
            ? Object.fromEntries(
                  givenPermissions
                      .map((permission) =>
                          typeof permission === "string"
                              ? [permission, true]
                              : [permission?.name, true]
                      )
                      .filter(([name]) => Boolean(name))
              )
            : givenPermissions;

        return (
            isSuperAdmin() ||
            permissions.some((permission) => permissionMap?.[permission] === true)
        );
    }

    return canAny(permissions);
}
