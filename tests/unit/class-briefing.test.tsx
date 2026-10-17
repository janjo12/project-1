import { fireEvent, render } from "@testing-library/react-native";
import { ClassBriefing } from "@/components/Common/ClassBriefing";

describe("class briefing when microgames are disabled", () => {
  it("starts directly from the class instructions without a microgame tutorial step", () => {
    const onNext = jest.fn();
    const onStart = jest.fn();
    const screen = render(
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
});
