"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "./input"
import { Button } from "./button"
import { cn } from "@/lib/utils"

function PasswordInput({ className, ...props }: React.ComponentProps<"input">) {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
        <div className="relative">
            <Input
                type={showPassword ? "text" : "password"}
                className={cn("pr-10", className)}
                {...props}
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground/50 hover:text-foreground"
                onClick={() => setShowPassword((prev) => !prev)}
            >
                {showPassword ? (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                ) : (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                </span>
            </Button>
        </div>
    )
}

export { PasswordInput }
