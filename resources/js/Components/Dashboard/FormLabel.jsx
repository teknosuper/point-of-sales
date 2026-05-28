import HintButton from "./HintButton";

export default function FormLabel({
    label,
    required = false,
    hintKey,
    hintText,
    children,
    className = "",
}) {
    return (
        <label className={`mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 ${className}`}>
            {label || children}
            {required && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger-500">
                    <span className="text-[10px] leading-none">*</span>
                    Wajib diisi
                </span>
            )}
            {(hintKey || hintText) && (
                <HintButton hintKey={hintKey}>{hintText}</HintButton>
            )}
        </label>
    );
}