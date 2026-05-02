"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KeyValueEntry } from "./form-utils";

export function KeyValueEditor(props: {
  label: string;
  addLabel: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  entries: KeyValueEntry[];
  onChange: (entries: KeyValueEntry[]) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{props.label}</div>
      <div className="grid gap-2 rounded-lg border bg-background p-3">
        {props.entries.length > 0 ? (
          props.entries.map((entry, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[minmax(120px,0.45fr)_minmax(0,1fr)_auto]"
            >
              <Input
                placeholder={props.keyPlaceholder}
                value={entry.key}
                onChange={(event) =>
                  props.onChange(
                    props.entries.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, key: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Input
                placeholder={props.valuePlaceholder}
                value={entry.value}
                onChange={(event) =>
                  props.onChange(
                    props.entries.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  props.onChange(
                    props.entries.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No {props.label.toLowerCase()} configured.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() =>
            props.onChange([...props.entries, { key: "", value: "" }])
          }
        >
          <PlusIcon />
          {props.addLabel}
        </Button>
      </div>
    </div>
  );
}
