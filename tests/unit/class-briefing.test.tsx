import { fireEvent, render } from "@testing-library/react-native";
import { ClassBriefing } from "@/components/Common/ClassBriefing";

describe("class briefing when microgames are disabled", () => {
  it("starts directly from the class instructions without a microgame tutorial step", async () => {
    const onNext = jest.fn();
    const onStart = jest.fn();
    const screen = await render(
      <ClassBriefing
        classId="warrior"
        page={0}
        damage={10}
        multiplayer={false}
        microgamesEnabled={false}
        onNext={onNext}
        onBack={jest.fn()}
        onPractice={jest.fn()}
        onStart={onStart}
      />,
    );

    expect(screen.queryByText(/Attack microgames are off/)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Start playing" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("shows the updated once-per-level Miracle rules in the Cleric briefing", async () => {
    const screen = await render(
      <ClassBriefing
        classId="cleric"
        page={0}
        damage={10}
        multiplayer={false}
        microgamesEnabled={false}
        onNext={jest.fn()}
        onBack={jest.fn()}
        onPractice={jest.fn()}
        onStart={jest.fn()}
      />,
    );

    expect(screen.getByText("Special · Miracle: Once per level, if you would die without a Health Potion, survive with half your maximum Health. It does not use Energy.")).toBeTruthy();
  });
});
