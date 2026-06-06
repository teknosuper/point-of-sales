export function permissionNamesFromRoles(roles = []) {
    return Array.from(
        new Set(
            (roles || [])
                .flatMap((role) => role?.permissions || [])
                .map((permission) =>
                    typeof permission === "string" ? permission : permission?.name
                )
                .filter(Boolean)
        )
    );
}

export function hasPermissionName(permissionNames = [], permissionName) {
    return new Set(permissionNames).has(permissionName);
}

export function hasAnyPermissionName(permissionNames = [], required = []) {
    const permissionSet = new Set(permissionNames);

    return (required || []).some((permissionName) => permissionSet.has(permissionName));
}

export function hasAnyPermissionPrefix(permissionNames = [], prefixes = []) {
    return (permissionNames || []).some((permissionName) =>
        (prefixes || []).some((prefix) => permissionName.startsWith(prefix))
    );
}

export function isTenantOnlyOutlets(outlets = []) {
    return (
        (outlets || []).length > 0 &&
        (outlets || []).every((outlet) => (outlet?.outlet_type || "main") === "tenant")
    );
}

export function classifyUserAccess({
    roles = [],
    outlets = [],
    preferredWorkspace = "standard",
    waiterServiceScope = "outlet_all",
}) {
    const permissionNames = permissionNamesFromRoles(roles);
    const tenantOnly = isTenantOnlyOutlets(outlets);
    const isKitchenWorkspace = preferredWorkspace === "kitchen";

    if (permissionNames.length === 0) {
        return {
            kindLabel: "Tanpa Akses",
            permissionNames,
            tenantOnly,
            isKitchenWorkspace,
        };
    }

    if (roles.some((role) => role?.name === "super-admin")) {
        return {
            kindLabel: "Super Admin",
            permissionNames,
            tenantOnly,
            isKitchenWorkspace,
        };
    }

    if (
        hasAnyPermissionName(permissionNames, [
            "users-access",
            "roles-access",
            "permissions-access",
        ])
    ) {
        return {
            kindLabel: "Admin Sistem",
            permissionNames,
            tenantOnly,
            isKitchenWorkspace,
        };
    }

    if (hasPermissionName(permissionNames, "waiter-board-access")) {
        return {
            kindLabel:
                waiterServiceScope === "tenant_only" || tenantOnly
                    ? "Waiter Tenant"
                    : "Waiter Outlet",
            permissionNames,
            tenantOnly,
            isKitchenWorkspace,
        };
    }

    if (
        hasAnyPermissionName(permissionNames, ["kitchen-access", "kitchen-manage"]) ||
        isKitchenWorkspace
    ) {
        return {
            kindLabel: tenantOnly ? "Dapur Tenant" : "Operator Dapur",
            permissionNames,
            tenantOnly,
            isKitchenWorkspace,
        };
    }

    if (hasPermissionName(permissionNames, "transactions-access")) {
        return {
            kindLabel: "Kasir",
            permissionNames,
            tenantOnly,
            isKitchenWorkspace,
        };
    }

    if (tenantOnly && hasAnyPermissionPrefix(permissionNames, ["products-", "pricing-rules-", "reports-", "profits-"])) {
        return {
            kindLabel: hasAnyPermissionName(permissionNames, ["pricing-rules-create", "pricing-rules-update", "pricing-rules-delete"])
                ? "Owner Tenant"
                : "Admin Tenant",
            permissionNames,
            tenantOnly,
            isKitchenWorkspace,
        };
    }

    if (
        hasAnyPermissionName(permissionNames, [
            "cashier-settlements-approve",
            "business-settings-update",
            "payment-settings-update",
            "outlets-update",
            "reports-access",
        ])
    ) {
        return {
            kindLabel: "Admin / Owner Outlet",
            permissionNames,
            tenantOnly,
            isKitchenWorkspace,
        };
    }

    return {
        kindLabel: "Admin Modul",
        permissionNames,
        tenantOnly,
        isKitchenWorkspace,
    };
}
