import { useCallback } from "react";
import _ from "underscore";

import { color } from "metabase/lib/colors";
import { useDispatch } from "metabase/lib/redux";
import { addUndo } from "metabase/redux/undo";

export const useRequests = () => {
  const dispatch = useDispatch();

  const showSuccessToast = useCallback(async () => {
    dispatch(
      addUndo({
        message: "Updated",
        toastColor: "success",
        dismissButtonColor: color("white"),
      }),
    );
  }, [dispatch]);

  const showErrorToast = useCallback(async () => {
    dispatch(
      addUndo({
        icon: "warning",
        message: "Error",
        toastColor: "error",
        dismissButtonColor: color("white"),
      }),
    );
  }, [dispatch]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedRequest = useCallback(
    _.debounce(
      (
        requestFunction: (
          arg: any,
          options: { fetch?: boolean },
        ) => Promise<any>,
        arg: any,
        options: { fetch?: boolean; [key: string]: any },
        onSuccess: () => Promise<any>,
        onError: () => Promise<any>,
      ) => {
        options.fetch ??= true;
        return requestFunction(arg, options).then(onSuccess).catch(onError);
      },
      // TODO: Perhaps increase the debounce wait time when user is
      // using arrow keys to change the strategy type
      200,
    ),
    [],
  );
  return { debouncedRequest, showSuccessToast, showErrorToast };
};
