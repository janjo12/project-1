import { StyleSheet, Text, View } from "react-native";

import { useThemeColors, type ThemeColors } from "@/components/theme";
import { getRoomPosition, getRooms, type DungeonMap } from "@/utils/dungeon-map";

type DungeonMapProps = {
  currentRoomId: string;
  map: DungeonMap;
};

export function DungeonMap({
  currentRoomId,
  map,
}: DungeonMapProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const roomMap = new Map(getRooms(map).map((room) => [room.id, room]));
  const currentRoomPosition = getRoomPosition(currentRoomId);

  return (
    <View
      accessibilityLabel={`Level ${map.level} Map`}
      style={styles.wrapper}
      testID="dungeon-map"
    >
      <Text style={styles.title}>Level {map.level} Map</Text>
      <View style={styles.columnHeaderRow}>
        <View style={styles.cornerLabel} />
        {map.rows.map((columnNumber) => {
          const isCurrentColumn = columnNumber === currentRoomPosition?.row;

          return (
            <Text
              key={columnNumber}
              style={[
                styles.columnLabel,
                isCurrentColumn && styles.currentAxisLabel,
              ]}
              testID={`map-column-label-${columnNumber}`}
            >
              {columnNumber}
            </Text>
          );
        })}
      </View>

      <View style={styles.body}>
        <View style={styles.rowLabels}>
          {map.columns.map((rowLetter) => {
            const isCurrentRow = rowLetter === currentRoomPosition?.column;

            return (
              <Text
                key={rowLetter}
                style={[
                  styles.rowLabel,
                  isCurrentRow && styles.currentAxisLabel,
                ]}
                testID={`map-row-label-${rowLetter}`}
              >
                {rowLetter}
              </Text>
            );
          })}
        </View>
        <View style={styles.grid}>
          {map.columns.map((rowLetter) => (
            <View key={rowLetter} style={styles.gridRow}>
              {map.rows.map((columnNumber) => {
                const room = roomMap.get(`${rowLetter}${columnNumber}`);
                const isCurrentRoom = room?.id === currentRoomId;
                const isRevealed = Boolean(room?.isRevealed);
                const hasStairs = room?.contents.some(
                  (content) => content.type === "stairs",
                );
                const hasWerewolf = room?.contents.some(
                  (content) =>
                    content.type === "monster" &&
                    content.chases &&
                    content.currentHealth > 0,
                );

                return (
                  <View key={columnNumber} style={styles.gridCell}>
                    {room && isRevealed ? (
                      <View
                        accessibilityLabel={`Room ${rowLetter}${columnNumber}`}
                        style={[
                          styles.room,
                          room.contents.length === 0 && styles.emptyRoom,
                          isCurrentRoom && styles.currentRoom,
                        ]}
                        testID={`map-room-${rowLetter}${columnNumber}`}
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
                        {hasStairs ? (
                          <Text style={styles.stairsIcon}>🪜</Text>
                        ) : null}
                        {hasWerewolf ? (
                          <Text style={styles.werewolfIcon}>🐺</Text>
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
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
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
      fontSize: 17,
      fontVariant: ["tabular-nums"],
      fontWeight: "900",
      lineHeight: 15,
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
      fontSize: 16,
      fontVariant: ["tabular-nums"],
      fontWeight: "900",
      lineHeight: 14,
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
      backgroundColor: colors.ink,
      height: "60%",
      justifyContent: "center",
      position: "relative",
      width: "60%",
    },
    emptyRoom: {
      backgroundColor: colors.ink,
    },
    currentRoom: {
      backgroundColor: colors.mapCurrentRoom,
    },
    currentAxisLabel: {
      color: colors.mapCurrentRoom,
    },
    stairsIcon: {
      color: colors.paper,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 13,
    },
    werewolfIcon: {
      color: colors.ink,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 13,
    },
    door: {
      backgroundColor: colors.ink,
      position: "absolute",
    },
    northDoor: {
      height: 7,
      left: "35%",
      top: -7,
      width: "30%",
    },
    eastDoor: {
      height: "40%",
      right: -7,
      top: "35%",
      width: 7,
    },
    southDoor: {
      bottom: -6,
      height: 7,
      left: "35%",
      width: "30%",
    },
    westDoor: {
      height: "40%",
      left: -7,
      top: "35%",
      width: 7,
    },
  });
}
