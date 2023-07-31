import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import { jt, t } from "ttag";

import _ from "underscore";
import Search from "metabase/entities/search";

import Card from "metabase/components/Card";
import EmptyState from "metabase/components/EmptyState";
import Subhead from "metabase/components/type/Subhead";

import NoResults from "assets/img/no_results.svg";
import PaginationControls from "metabase/components/PaginationControls";
import { usePagination } from "metabase/hooks/use-pagination";
import {
  getFiltersFromLocation,
  getSearchTextFromLocation,
} from "metabase/search/utils";
import { TypeSearchSidebar } from "metabase/search/components/TypeSearchSidebar/TypeSearchSidebar";
import { PAGE_SIZE } from "metabase/search/containers/constants";
import { SearchFilterKeys } from "metabase/search/types";
import { SearchResult } from "metabase/search/components/SearchResult";
import {
  SearchBody,
  SearchControls,
  SearchEmptyState,
  SearchHeader,
  SearchMain,
  SearchRoot,
} from "./SearchApp.styled";

export default function SearchApp({ location }) {
  const { handleNextPage, handlePreviousPage, setPage, page } = usePagination();

  const searchText = useMemo(
    () => getSearchTextFromLocation(location),
    [location],
  );

  const searchFilters = useMemo(() => {
    return getFiltersFromLocation(location);
  }, [location]);

  const [selectedSidebarType, setSelectedSidebarType] = useState(null);

  useEffect(() => {
    setSelectedSidebarType(null);
  }, [searchText, searchFilters]);

  const query = useMemo(
    () => ({
      q: searchText,
      ..._.omit(searchFilters, SearchFilterKeys.Type),
      models: selectedSidebarType ?? searchFilters[SearchFilterKeys.Type],
      limit: PAGE_SIZE,
      offset: PAGE_SIZE * page,
    }),
    [searchText, searchFilters, selectedSidebarType, page],
  );

  const onChangeSelectedType = filter => {
    setSelectedSidebarType(filter);
    setPage(0);
  };

  return (
    <SearchRoot data-testid="search-app">
      {searchText && (
        <SearchHeader>
          <Subhead>{jt`Results for "${searchText}"`}</Subhead>
        </SearchHeader>
      )}
      <Search.ListLoader query={query} wrapped>
        {({ list, metadata }) =>
          list && list.length > 0 ? (
            <SearchBody>
              <SearchMain>
                <SearchResultSection items={list} />
                <PaginationControls
                  showTotal
                  pageSize={PAGE_SIZE}
                  page={page}
                  itemsLength={list.length}
                  total={metadata.total}
                  onNextPage={handleNextPage}
                  onPreviousPage={handlePreviousPage}
                />
              </SearchMain>
              {searchFilters?.type || metadata.available_models ? (
                <SearchControls>
                  <TypeSearchSidebar
                    availableModels={metadata.available_models.filter(
                      filter =>
                        !searchFilters?.type ||
                        searchFilters.type.includes(filter),
                    )}
                    selectedType={selectedSidebarType}
                    onSelectType={onChangeSelectedType}
                  />
                </SearchControls>
              ) : null}
            </SearchBody>
          ) : (
            <SearchEmptyState>
              <Card>
                <EmptyState
                  title={t`Didn't find anything`}
                  message={t`There weren't any results for your search.`}
                  illustrationElement={<img src={NoResults} />}
                />
              </Card>
            </SearchEmptyState>
          )
        }
      </Search.ListLoader>
    </SearchRoot>
  );
}

SearchApp.propTypes = {
  location: PropTypes.object,
};

const SearchResultSection = ({ items }) => (
  <Card className="pt2">
    {items.map(item => {
      return <SearchResult key={`${item.id}__${item.model}`} result={item} />;
    })}
  </Card>
);

SearchResultSection.propTypes = {
  items: PropTypes.array,
};
