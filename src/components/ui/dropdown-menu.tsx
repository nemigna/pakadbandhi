import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
export function DropdownMenu({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: { label: string; action: () => void; checked?: boolean }[];
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="dropdown" align="end" sideOffset={6}>
          {items.map((item) => (
            <Dropdown.Item
              className="dropdown-item"
              key={item.label}
              onSelect={item.action}
            >
              <span>{item.label}</span>
              {item.checked && <span aria-label="Selected">✓</span>}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
