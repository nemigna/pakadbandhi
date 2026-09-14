import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="checkbox-label">
      <CheckboxPrimitive.Root
        className="checkbox"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(x) => onCheckedChange(x === true)}
      >
        <CheckboxPrimitive.Indicator>
          <Check size={13} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span>{label}</span>
    </label>
  );
}
