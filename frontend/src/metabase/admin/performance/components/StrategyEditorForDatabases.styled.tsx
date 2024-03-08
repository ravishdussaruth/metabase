import styled from "@emotion/styled";
import type { HTMLAttributes } from "react";

import { color } from "metabase/lib/colors";
import type { ButtonProps as BaseButtonProps } from "metabase/ui";
import { Button } from "metabase/ui";

type ButtonProps = BaseButtonProps & HTMLAttributes<HTMLButtonElement>;

export const Panel = styled.div`
  overflow-y: auto;
  display: flex;
  flex-flow: column nowrap;
  padding: 1.5rem;
  background-color: ${color("white")};
  border-style: solid;
  border-color: ${color("border")};
  border-width: 2px 1px 2px 0;
  &:first-child {
    border-left-width: 2px;
    border-top-left-radius: 1rem;
    border-bottom-left-radius: 1rem;
  }
  &:last-child {
    border-right-width: 2px;
    border-top-right-radius: 1rem;
    border-bottom-right-radius: 1rem;
  }
`;

export const Chip = styled(Button, {
  shouldForwardProp: prop => prop !== "configIsBeingEdited",
})<
  {
    configIsBeingEdited?: boolean;
    variant: string;
  } & ButtonProps
>`
  cursor: pointer;
  display: flex;
  flex-flow: row nowrap;
  padding: 1rem;
  ${({ variant }) =>
    `border: 1px solid ${color(
      variant === "filled" ? "brand" : "border",
    )} ! important`};
  span {
    gap: 0.5rem;
  }
`;

Chip.defaultProps = { animate: false, radius: "sm" };

export const TabWrapper = styled.div`
  display: grid;
  grid-template-rows: auto 1fr;
  width: 100%;
`;
