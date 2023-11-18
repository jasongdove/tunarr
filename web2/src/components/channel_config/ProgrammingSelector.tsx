import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  Typography,
} from '@mui/material';
import { PlexServerSettings } from 'dizquetv-types';
import {
  PlexLibraryMovies,
  PlexLibrarySection,
  PlexLibraryShows,
  PlexMedia,
  PlexMovie,
  PlexTvShow,
  isPlexMovie,
  isPlexShow,
} from 'dizquetv-types/plex';
import { isEmpty, isUndefined } from 'lodash-es';
import React, { useEffect, useState } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { usePlex, usePlexTyped } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';

interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  style: React.CSSProperties;
  index: number;
}

function PlexShowListItem(props: PlexListItemProps<PlexTvShow>) {
  const [open, setOpen] = useState(false);
  const { style, item, index } = props;

  const handleClick = () => {
    setOpen(!open);
  };

  return (
    <>
      <ListItem style={style} key={index} component="div" disablePadding>
        <ListItemIcon onClick={handleClick}>
          <ExpandMore />
        </ListItemIcon>
        <ListItemText primary={item.title} />
        <Button>Add</Button>
      </ListItem>
      ;
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List>
          <ListItem>
            <ListItemText primary="test" />
          </ListItem>
          <ListItem>
            <ListItemText primary="test" />
          </ListItem>
          <ListItem>
            <ListItemText primary="test" />
          </ListItem>
        </List>
      </Collapse>
    </>
  );
}

function PlexMovieListItem(props: PlexListItemProps<PlexMovie>) {
  const { style, item, index } = props;

  return (
    <ListItem style={style} key={index} component="div" disablePadding>
      <ListItemText primary={item.title} />
      <Button>Add</Button>
    </ListItem>
  );
}

function PlexMediaListItem(props: PlexListItemProps<PlexMedia>) {
  const { style, item, index } = props;

  return (
    <ListItem style={style} key={index} component="div" disablePadding>
      {isPlexShow(item) && (
        <ListItemIcon>
          <ExpandMore />
        </ListItemIcon>
      )}
      <ListItemText primary={item.title} />
      <Button>Add</Button>
    </ListItem>
  );
}

function PlexDirectoryListItem(props: {
  server: PlexServerSettings;
  item: PlexLibrarySection;
  onItemAdd: (item: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const { isPending, data } = usePlexTyped<
    PlexLibraryMovies | PlexLibraryShows
  >(props.server.name, `/library/sections/${props.item.key}/all`, open);

  const handleClick = () => {
    setOpen(!open);
  };

  const renderCollectionRow = (props: ListChildComponentProps) => {
    const { index, style } = props;
    const metadata = data!.Metadata[index];

    if (isPlexShow(metadata)) {
      return <PlexShowListItem item={metadata} style={style} index={index} />;
    } else if (isPlexMovie(metadata)) {
      return <PlexMovieListItem item={metadata} style={style} index={index} />;
    } else {
      return null;
    }
  };

  return (
    <>
      <ListItem component="div" disablePadding>
        <ListItemButton selected={open} onClick={handleClick}>
          <ListItemIcon>{open ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText primary={props.item.title} />
          <Button>Add All</Button>
        </ListItemButton>
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {isPending ? (
          <Skeleton>
            <Box sx={{ width: '100%', height: 400, pl: 4 }} />
          </Skeleton>
        ) : (
          <Box sx={{ width: '100%', height: 400, pl: 4 }}>
            <FixedSizeList
              height={400}
              itemCount={data?.Metadata?.length || 0}
              itemSize={46}
              width="100%"
              overscanCount={5}
            >
              {renderCollectionRow}
            </FixedSizeList>
          </Box>
        )}
      </Collapse>
      <Divider variant="fullWidth" />
    </>
  );
}

export default function ProgrammingSelector() {
  const { data: plexServers } = usePlexServerSettings();

  const [selectedServer, setSelectedServer] = useState<
    PlexServerSettings | undefined
  >(undefined);

  useEffect(() => {
    const server =
      !isUndefined(plexServers) && !isEmpty(plexServers)
        ? plexServers[0]
        : undefined;

    setSelectedServer(server);
  }, [plexServers]);

  const { data: plexResponse } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
    !isUndefined(selectedServer),
  );

  return (
    <>
      <DialogTitle>Add Programming</DialogTitle>
      <DialogContent>
        <FormControl fullWidth size="small">
          {selectedServer && (
            <Select value={selectedServer?.name}>
              {plexServers?.map((server) => (
                <MenuItem key={server.name} value={server.name}>
                  {server.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
        <List component="nav" sx={{ width: '100%' }}>
          {plexResponse?.Directory?.map((dir) => (
            <PlexDirectoryListItem
              server={selectedServer!}
              key={dir.uuid}
              item={dir}
              onItemAdd={() => {}}
            />
          ))}
        </List>
        <Typography>Selected Items</Typography>
      </DialogContent>
    </>
  );
}
