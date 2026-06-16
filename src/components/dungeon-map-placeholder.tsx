import { StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";
import { getRoomPosition, getRooms, type DungeonMap } from "@/utils/dungeon-map";

type DungeonMapPlaceholderProps = {
  currentRoomId: string;
  map: DungeonMap;
  werewolfRoomId?: string;
};

export function DungeonMapPlaceholder({
  currentRoomId,
  map,
  werewolfRoomId,
}: DungeonMapPlaceholderProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const roomMap = new Map(getRooms(map).map((room) => [room.id, room]));
  const currentRoomPosition = getRoomPosition(currentRoomId);

  return (
    <View
      accessibilityLabel={`Level ${map.level} Map`}
      style={styles.wrapper}
      testID="dungeon-map-placeholder"
    >
      <Text style={styles.title}>Level {map.level} Map</Text>
      <View style={styles.columnHeaderRow}>
        <View style={styles.cornerLabel} />
        {map.columns.map((column) => {
          const isCurrentColumn = column === currentRoomPosition?.column;

          return (
            <Text
              key={column}
              style={[
                styles.columnLabel,
                isCurrentColumn && styles.currentAxisLabel,
              ]}
              testID={`map-column-label-${column}`}
            >
              {column}
            </Text>
          );
        })}
      </View>

      <View style={styles.body}>
        <View style={styles.rowLabels}>
          {map.rows.map((row) => {
            const isCurrentRow = row === currentRoomPosition?.row;

            return (
              <Text
                key={row}
                style={[
                  styles.rowLabel,
                  isCurrentRow && styles.currentAxisLabel,
                ]}
                testID={`map-row-label-${row}`}
              >
                {row}
              </Text>
            );
          })}
        </View>
        <View style={styles.grid}>
          {map.rows.map((row) => (
            <View key={row} style={styles.gridRow}>
              {map.columns.map((column) => {
                const room = roomMap.get(`${column}${row}`);
                const isCurrentRoom = room?.id === currentRoomId;
                const hasWerewolf = room?.id === werewolfRoomId;

                return (
                  <View key={column} style={styles.gridCell}>
                    {room ? (
                      <View
                        accessibilityLabel={`Room ${column}${row}`}
                        style={[
                          styles.room,
                          room.contents === "empty" && styles.emptyRoom,
                          room.contents === "stairs" && styles.stairsRoom,
                          isCurrentRoom && styles.currentRoom,
                        ]}
                        testID={`map-room-${column}${row}`}
                      >
                        {room.north === "open" ? (
                          <View style={[styles.door, styles.northDoor]} />
                        ) : null}
                        {room.east === "open" ? (
                          <View style={[styles.door, styles.eastDoor]} />
                        ) : null}
                        {room.south === "open" ? (
                          <View style={[styles.door, styles.southDoor]} />
                        ) : null}
                        {room.west === "open" ? (
                          <View style={[styles.door, styles.westDoor]} />
                        ) : null}
                        {room.contents === "stairs" ? (
                          <Text style={styles.stairsIcon}>S</Text>
                        ) : null}
                        {hasWerewolf ? (
                          <Text style={styles.werewolfIcon}>W</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      alignSelf: "stretch",
      flex: 1,
      gap: 4,
      maxWidth: 244,
      minHeight: 352,
      minWidth: 188,
    },
    title: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 16,
      textAlign: "center",
    },
    columnHeaderRow: {
      flexDirection: "row",
      gap: 2,
      paddingRight: 2,
    },
    cornerLabel: {
      width: 24,
    },
    columnLabel: {
      color: colors.fadedInk,
      flex: 1,
      fontSize: 10,
      fontVariant: ["tabular-nums"],
      fontWeight: "800",
      lineHeight: 14,
      textAlign: "center",
    },
    body: {
      flex: 1,
      flexDirection: "row",
      gap: 4,
    },
    rowLabels: {
      gap: 2,
      width: 20,
    },
    rowLabel: {
      color: colors.fadedInk,
      flex: 1,
      fontSize: 9,
      fontVariant: ["tabular-nums"],
      fontWeight: "800",
      lineHeight: 13,
      textAlign: "right",
      textAlignVertical: "center",
    },
    grid: {
      borderColor: colors.fadedInk,
      borderLeftWidth: 1,
      borderTopWidth: 1,
      flex: 1,
    },
    gridRow: {
      flex: 1,
      flexDirection: "row",
    },
    gridCell: {
      alignItems: "center",
      borderBottomWidth: 1,
      borderColor: colors.fadedInk,
      borderRightWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 22,
    },
    room: {
      alignItems: "center",
      backgroundColor: colors.paperLight,
      borderColor: colors.sepia,
      borderRadius: 3,
      borderWidth: 1,
      height: "58%",
      justifyContent: "center",
      position: "relative",
      width: "58%",
    },
    emptyRoom: {
      backgroundColor: colors.paper,
    },
    currentRoom: {
      backgroundColor: colors.mapCurrentRoom,
      borderColor: colors.mapCurrentRoom,
      borderWidth: 2,
    },
    currentAxisLabel: {
      color: colors.mapCurrentRoom,
    },
    stairsRoom: {
      backgroundColor: colors.sepia,
    },
    stairsIcon: {
      color: colors.paper,
      fontSize: 9,
      fontWeight: "900",
      lineHeight: 11,
    },
    werewolfIcon: {
      color: colors.ink,
      fontSize: 9,
      fontWeight: "900",
      lineHeight: 11,
    },
    door: {
      backgroundColor: colors.accent,
      position: "absolute",
    },
    northDoor: {
      height: 5,
      left: "35%",
      top: -3,
      width: "30%",
    },
    eastDoor: {
      height: "30%",
      right: -3,
      top: "35%",
      width: 5,
    },
    southDoor: {
      bottom: -3,
      height: 5,
      left: "35%",
      width: "30%",
    },
    westDoor: {
      height: "30%",
      left: -3,
      top: "35%",
      width: 5,
    },
  });
}
