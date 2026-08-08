type AlertType = "success" | "error" | "warning" | "info";

type AlertMessageProps = {
  type: AlertType;
  message: string;
};

export default function AlertMessage({
  type,
  message,
}: AlertMessageProps) {
  if (!message) return null;

  const styles = {
    success: {
      container: "border-green-200 bg-green-50 text-green-800",
      icon: "✅",
    },
    error: {
      container: "border-red-200 bg-red-50 text-red-800",
      icon: "❌",
    },
    warning: {
      container: "border-yellow-200 bg-yellow-50 text-yellow-800",
      icon: "⚠️",
    },
    info: {
      container: "border-blue-200 bg-blue-50 text-blue-800",
      icon: "ℹ️",
    },
  };

  const selected = styles[type];

  return (
    <div
      role="alert"
      className={`mt-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${selected.container}`}
    >
      <span aria-hidden="true" className="text-base">
        {selected.icon}
      </span>

      <span>{message}</span>
    </div>
  );
}
