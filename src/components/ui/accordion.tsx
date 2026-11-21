import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import type { CSSProperties, ReactNode } from "react";
import "./accordion.css";

export function Accordion({
  title,
  summary,
  leadingIcon,
  children,
  icon,
  style,
  defaultOpen = false,
}: {
  title: string;
  defaultOpen?: boolean;
  leadingIcon?: ReactNode;
  summary?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <BaseAccordion.Root
      className="ui-accordion"
      defaultValue={defaultOpen ? ["details"] : []}
      key={String(defaultOpen)}
      style={style}
    >
      <BaseAccordion.Item value="details">
        <div className="ui-accordion__summary">
          <BaseAccordion.Header className="ui-accordion__heading">
            <BaseAccordion.Trigger
              aria-label={title || "Toggle details"}
              className="ui-accordion__trigger"
            >
              <span className="ui-accordion__label">
                {leadingIcon}
                {title}
              </span>
              {icon ? (
                <span className="ui-accordion__indicator">{icon}</span>
              ) : null}
            </BaseAccordion.Trigger>
          </BaseAccordion.Header>
          {summary}
        </div>
        <BaseAccordion.Panel className="ui-accordion__panel">
          {children}
        </BaseAccordion.Panel>
      </BaseAccordion.Item>
    </BaseAccordion.Root>
  );
}
