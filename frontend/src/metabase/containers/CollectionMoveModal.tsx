import { useState } from "react";
import { t } from "ttag";

import CreateCollectionModal from "metabase/collections/containers/CreateCollectionModal";
import { CollectionPickerModal, type CollectionPickerItem } from "metabase/common/components/EntityPicker";
import ModalContent from "metabase/components/ModalContent";
import CollectionPicker from "metabase/containers/CollectionPicker";
import Button from "metabase/core/components/Button";
import type { Collection, CollectionId, CollectionItem } from "metabase-types/api";

import { ButtonContainer } from "./CollectionMoveModal.styled";

interface CollectionMoveModalProps {
  title: string;
  onClose: () => void;
  onMove: (collection: any) => void;
  initialCollectionId: CollectionId;
}

export const CollectionMoveModal = ({
  title,
  onClose,
  onMove,
  initialCollectionId,
}: CollectionMoveModalProps) => {

  const canMoveCollection = (item: CollectionPickerItem) =>
    item.can_write &&
    item.id !== initialCollectionId &&
    !item?.location?.split('/').includes(initialCollectionId as string);

  return (
    <CollectionPickerModal
      title={title}
      value={{
        id: initialCollectionId,
        model: "collection"
      }}
      onChange={(newCollection) => onMove({ id: newCollection.id  })}
      options={{
        showSearch: true,
        allowCreateNew: true,
        hasConfirmButtons: true,
        showRootCollection: true,
        showPersonalCollections: true,
        confirmButtonText: t`Move`,
      }}
      shouldShowItem={canMoveCollection}
      onClose={onClose}
    />
  )
};
