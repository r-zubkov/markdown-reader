import {
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  type MenuItemProps,
  type MenuProps,
  type MenuTriggerProps,
  type PopoverProps,
} from "react-aria-components";

import { cn } from "cn";

function DropdownMenu(props: MenuTriggerProps) { return <MenuTrigger {...props} />; }
function DropdownMenuContent({ className, ...props }: PopoverProps) { return <Popover className={cn("library-actions__popover", className)} {...props} />; }
function DropdownMenuList<T extends object>({ className, ...props }: MenuProps<T>) { return <Menu className={cn("library-actions__menu", className)} {...props} />; }
function DropdownMenuItem<T extends object>({ className, ...props }: MenuItemProps<T>) { return <MenuItem className={cn("library-actions__item", className)} {...props} />; }

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuList };
