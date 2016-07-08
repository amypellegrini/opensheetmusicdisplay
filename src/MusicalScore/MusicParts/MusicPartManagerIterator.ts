import {MusicPartManager} from "./MusicPartManager";
import {Fraction} from "../../Common/DataObjects/fraction";
import {Repetition} from "../MusicSource/Repetition";
import {DynamicsContainer} from "../VoiceData/HelperObjects/DynamicsContainer";
import {MappingSourceMusicPart} from "../MusicSource/MappingSourceMusicPart";
import {SourceMeasure} from "../VoiceData/SourceMeasure";
import {VoiceEntry} from "../VoiceData/VoiceEntry";
import {Instrument} from "../Instrument";
import {VerticalSourceStaffEntryContainer} from "../VoiceData/VerticalSourceStaffEntryContainer";
import {RhythmInstruction} from "../VoiceData/Instructions/RhythmInstruction";
import {AbstractNotationInstruction} from "../VoiceData/Instructions/AbstractNotationInstruction";
import {RepetitionInstruction} from "../VoiceData/Instructions/RepetitionInstruction";
import {ContinuousDynamicExpression} from "../VoiceData/Expressions/ContinuousExpressions/continuousDynamicExpression";
import {InstantaniousDynamicExpression} from "../VoiceData/Expressions/instantaniousDynamicExpression";
import {MultiTempoExpression} from "../VoiceData/Expressions/multiTempoExpression";
import {AbstractExpression} from "../VoiceData/Expressions/abstractExpression";

export class MusicPartManagerIterator {
    constructor(manager: MusicPartManager, startTimestamp?: Fraction, endTimestamp?: Fraction) {
        try {
            this.frontReached = true;
            this.manager = manager;
            this.currentVoiceEntries = undefined;
            this.frontReached = false;
            for (let rep of manager.MusicSheet.Repetitions) {
                this.setRepetitionIterationCount(rep, 1);
            }
            this.activeDynamicExpressions = new Array(manager.MusicSheet.getCompleteNumberOfStaves());
            this.currentMeasure = this.manager.MusicSheet.SourceMeasures[0];
            if (startTimestamp === undefined) { return; }
            do {
                this.moveToNext();
            } while ((this.currentVoiceEntries === undefined || this.currentTimeStamp.lt(startTimestamp)) && !this.endReached);
            for (let staffIndex: number = 0; staffIndex < this.activeDynamicExpressions.length; staffIndex++) {
                if (this.activeDynamicExpressions[staffIndex] !== undefined) {
                    if (this.activeDynamicExpressions[staffIndex] instanceof ContinuousDynamicExpression) {
                        let continuousDynamic: ContinuousDynamicExpression =
                            <ContinuousDynamicExpression>this.activeDynamicExpressions[staffIndex];
                        this.currentDynamicChangingExpressions.push(new DynamicsContainer(continuousDynamic, staffIndex));
                    } else {
                        let instantaniousDynamic: InstantaniousDynamicExpression =
                            <InstantaniousDynamicExpression>this.activeDynamicExpressions[staffIndex];
                        this.currentDynamicChangingExpressions.push(new DynamicsContainer(instantaniousDynamic, staffIndex));
                    }
                }
            }
            this.currentTempoChangingExpression = this.activeTempoExpression;
        } catch (err) {
            console.log("MusicPartManagerIterator: Exception." + err); // FIXME
        }

    }
    public backJumpOccurred: boolean;
    public forwardJumpOccurred: boolean;
    private manager: MusicPartManager;
    private currentMappingPart: MappingSourceMusicPart;
    private currentMeasure: SourceMeasure;
    private currentMeasureIndex: number = 0;
    private currentPartIndex: number = 0;
    private currentVoiceEntryIndex: number = -1;
    private currentDynamicEntryIndex: number = 0;
    private currentTempoEntryIndex: number = 0;
    private currentVoiceEntries: VoiceEntry[];
    private currentDynamicChangingExpressions: DynamicsContainer[] = [];
    private currentTempoChangingExpression: MultiTempoExpression;
    // FIXME: replace these two with a real Dictionary!
    private repetitionIterationCountDictKeys: Repetition[];
    private repetitionIterationCountDictValues: number[];
    private currentRepetition: Repetition = undefined;
    private endReached: boolean = false;
    private frontReached: boolean = false;
    private currentTimeStamp: Fraction = new Fraction(0, 1);
    private currentEnrolledMeasureTimestamp: Fraction = new Fraction(0, 1);
    private currentVerticalContainerInMeasureTimestamp: Fraction = new Fraction(0, 1);
    private jumpResponsibleRepetition: Repetition = undefined;
    private activeDynamicExpressions: AbstractExpression[] = [];
    private activeTempoExpression: MultiTempoExpression;

    public get EndReached(): boolean {
        return this.endReached;
    }
    public get FrontReached(): boolean {
        return this.frontReached;
    }
    public get CurrentMeasure(): SourceMeasure {
        return this.currentMeasure;
    }
    public get CurrentRepetition(): Repetition {
        return this.currentRepetition;
    }
    public get CurrentRepetitionIteration(): number {
        if (this.CurrentRepetition !== undefined) {
            return this.getRepetitionIterationCount(this.CurrentRepetition);
        }
        return 0;
    }
    public get CurrentJumpResponsibleRepetitionIterationBeforeJump(): number {
        if (this.jumpResponsibleRepetition !== undefined) {
            return this.getRepetitionIterationCount(this.jumpResponsibleRepetition) - 1;
        }
        return 0;
    }
    public get CurrentVoiceEntries(): VoiceEntry[] {
        return this.currentVoiceEntries;
    }
    public get CurrentMeasureIndex(): number {
        return this.currentMeasureIndex;
    }
    public get CurrentEnrolledTimestamp(): Fraction {
        return Fraction.plus(this.currentEnrolledMeasureTimestamp, this.currentVerticalContainerInMeasureTimestamp);
    }
    public get CurrentSourceTimestamp(): Fraction {
        return this.currentTimeStamp;
    }
    public get JumpOccurred(): boolean {
        return this.backJumpOccurred || this.forwardJumpOccurred;
    }
    public get ActiveTempoExpression(): MultiTempoExpression {
        return this.activeTempoExpression;
    }
    public get ActiveDynamicExpressions(): AbstractExpression[] {
        return this.activeDynamicExpressions;
    }
    public get CurrentTempoChangingExpression(): MultiTempoExpression {
        return this.currentTempoChangingExpression;
    }
    public get JumpResponsibleRepetition(): Repetition {
        return this.jumpResponsibleRepetition;
    }
    public clone(): MusicPartManagerIterator {
        let ret: MusicPartManagerIterator = new MusicPartManagerIterator(this.manager);
        ret.currentVoiceEntryIndex = this.currentVoiceEntryIndex;
        ret.currentMappingPart = this.currentMappingPart;
        ret.currentPartIndex = this.currentPartIndex;
        ret.currentVoiceEntries = this.currentVoiceEntries;
        ret.endReached = this.endReached;
        ret.frontReached = this.frontReached;
        return ret;
    }

    public CurrentVisibleVoiceEntries(instrument?: Instrument): VoiceEntry[] {
        let voiceEntries: VoiceEntry[] = [];
        if (this.currentVoiceEntries === undefined) {
            return voiceEntries;
        }
        if (instrument !== undefined) {
            for (let entry of this.currentVoiceEntries) {
                if (entry.ParentVoice.Parent.IdString === instrument.IdString) {
                    this.getVisibleEntries(entry, voiceEntries);
                    return voiceEntries;
                }
            }
        } else {
            for (let entry of this.currentVoiceEntries) {
                this.getVisibleEntries(entry, voiceEntries);
            }
        }
        return voiceEntries;
    }

    public CurrentAudibleVoiceEntries(instrument?: Instrument): VoiceEntry[] {
        let voiceEntries: VoiceEntry[] = [];
        if (this.currentVoiceEntries === undefined) {
            return voiceEntries;
        }
        if (instrument !== undefined) {
            for (let entry of this.currentVoiceEntries) {
                if (entry.ParentVoice.Parent.IdString === instrument.IdString) {
                    this.getAudibleEntries(entry, voiceEntries);
                    return voiceEntries;
                }
            }
        } else {
            for (let entry of this.currentVoiceEntries) {
                this.getAudibleEntries(entry, voiceEntries);
            }
        }
        return voiceEntries;
    }

    public getCurrentDynamicChangingExpressions(): DynamicsContainer[] {
        return this.currentDynamicChangingExpressions;
    }

    public CurrentScoreFollowingVoiceEntries(instrument?: Instrument): VoiceEntry[] {
        let voiceEntries: VoiceEntry[] = [];
        if (this.currentVoiceEntries === undefined) {
            return voiceEntries;
        }
        if (instrument !== undefined) {
            for (let entry of this.currentVoiceEntries) {
                if (entry.ParentVoice.Parent.IdString === instrument.IdString) {
                    this.getScoreFollowingEntries(entry, voiceEntries);
                    return voiceEntries;
                }
            }
        } else {
            for (let entry of this.currentVoiceEntries) {
                this.getScoreFollowingEntries(entry, voiceEntries);
            }
        }
        return voiceEntries;
    }

    //public currentPlaybackSettings(): PlaybackSettings {
    //    return this.manager.MusicSheet.SheetPlaybackSetting;
    //}
    public moveToNext(): void {
        this.forwardJumpOccurred = this.backJumpOccurred = false;
        if (this.endReached) { return; }
        if (this.currentVoiceEntries !== undefined) {
            this.currentVoiceEntries = [];
        }
        this.recursiveMove();
        if (this.currentMeasure === undefined) {
            this.currentTimeStamp = new Fraction(99999, 1);
        }
    }
    public moveToNextVisibleVoiceEntry(notesOnly: boolean): void {
        while (!this.endReached) {
            this.moveToNext();
            if (this.checkEntries(notesOnly)) { return; }
        }
    }
    private resetRepetitionIterationCount(repetition: Repetition): number {
        this.setRepetitionIterationCount(repetition, 1);
        return 1;
    }
    private incrementRepetitionIterationCount(repetition: Repetition): number {
        if (this.repetitionIterationCountDictKeys.indexOf(repetition) === -1) {
            return this.setRepetitionIterationCount(repetition, 1);
        } else {
            return this.setRepetitionIterationCount(repetition, this.getRepetitionIterationCount(repetition) + 1);
        }
    }
    private setRepetitionIterationCount(repetition: Repetition, iterationCount: number): number {
        let i: number = this.repetitionIterationCountDictKeys.indexOf(repetition);
        if (i === -1) {
            this.repetitionIterationCountDictKeys.push(repetition);
            this.repetitionIterationCountDictValues.push(iterationCount);
        } else {
            this.repetitionIterationCountDictValues[i] = iterationCount;
        }
        return iterationCount;
    }
    private getRepetitionIterationCount(rep: Repetition): number {
        let i: number = this.repetitionIterationCountDictKeys.indexOf(rep);
        if (i !== -1) {
            return this.repetitionIterationCountDictValues[i];
        }
    }
/*    private moveTempoIndexToTimestamp(measureNumber: number): void {
        for (let index: number = 0; index < this.manager.MusicSheet.TimestampSortedTempoExpressionsList.length; index++) {
            if (this.manager.MusicSheet.TimestampSortedTempoExpressionsList[index].SourceMeasureParent.MeasureNumber >= measureNumber) {
                this.currentTempoEntryIndex = Math.Max(-1, index - 1);
                return
            }
        }
    }
    private getNextTempoEntryTimestamp(): Fraction {
        if (this.currentTempoEntryIndex >= this.manager.MusicSheet.TimestampSortedTempoExpressionsList.length - 1) {
            return new Fraction(99999, 1);
        }
        return this.manager.MusicSheet.TimestampSortedTempoExpressionsList[this.currentTempoEntryIndex + 1].SourceMeasureParent.AbsoluteTimestamp +
        this.manager.MusicSheet.TimestampSortedTempoExpressionsList[this.currentTempoEntryIndex + 1].Timestamp;
    }
    private moveToNextDynamic(): void {
        this.currentDynamicEntryIndex++;
        this.currentDynamicChangingExpressions.Clear();
        let curDynamicEntry: DynamicsContainer = this.manager.MusicSheet.TimestampSortedDynamicExpressionsList[this.currentDynamicEntryIndex];
        this.currentDynamicChangingExpressions.push(curDynamicEntry);
        let tsNow: Fraction = curDynamicEntry.parMultiExpression().AbsoluteTimestamp;
        for (let i: number = this.currentDynamicEntryIndex + 1; i < this.manager.MusicSheet.TimestampSortedDynamicExpressionsList.length; i++) {
            curDynamicEntry = this.manager.MusicSheet.TimestampSortedDynamicExpressionsList[i];
            if ((curDynamicEntry.parMultiExpression().AbsoluteTimestamp !== tsNow)) { break; }
            this.currentDynamicEntryIndex = i;
            this.currentDynamicChangingExpressions.push(curDynamicEntry);
        }
    }
    private moveDynamicIndexToTimestamp(absoluteTimestamp: Fraction): void {
        let dynamics: DynamicsContainer[] = this.manager.MusicSheet.TimestampSortedDynamicExpressionsList;
        for (let index: number = 0; index < dynamics.length; index++) {
            if (dynamics[index].parMultiExpression().AbsoluteTimestamp >= absoluteTimestamp) {
                this.currentDynamicEntryIndex = Math.Max(0, index - 1);
                return
            }
        }
    }
    private getNextDynamicsEntryTimestamp(): Fraction {
        if (this.currentDynamicEntryIndex >= this.manager.MusicSheet.TimestampSortedDynamicExpressionsList.length - 1) {
            return new Fraction(99999, 1);
        }
        return this.manager.MusicSheet.TimestampSortedDynamicExpressionsList[this.currentDynamicEntryIndex + 1].parMultiExpression().AbsoluteTimestamp;
    }
    */
    private handleRepetitionsAtMeasureBegin(): void {
        for (let idx: number = 0, len: number = this.currentMeasure.FirstRepetitionInstructions.length; idx < len; ++idx) {
            let repetitionInstruction: RepetitionInstruction = this.currentMeasure.FirstRepetitionInstructions[idx];
            if (repetitionInstruction.parentRepetition === undefined) { continue; }
            let currentRepetition: Repetition = repetitionInstruction.parentRepetition;
            this.currentRepetition = currentRepetition;
            if (currentRepetition.StartIndex === this.currentMeasureIndex) {
                if (
                  this.JumpResponsibleRepetition !== undefined &&
                  currentRepetition !== this.JumpResponsibleRepetition &&
                  currentRepetition.StartIndex >= this.JumpResponsibleRepetition.StartIndex &&
                  currentRepetition.EndIndex <= this.JumpResponsibleRepetition.EndIndex
                ) {
                    this.resetRepetitionIterationCount(currentRepetition);
                }
            }
        }
    }

    private handleRepetitionsAtMeasureEnd(): void {
        for (let idx: number = 0, len: number = this.currentMeasure.LastRepetitionInstructions.length; idx < len; ++idx) {
            let repetitionInstruction: RepetitionInstruction = this.currentMeasure.LastRepetitionInstructions[idx];
            let currentRepetition: Repetition = repetitionInstruction.parentRepetition;
            if (currentRepetition === undefined) { continue; }
            if (currentRepetition.BackwardJumpInstructions.indexOf(repetitionInstruction) > -1) {
                if (this.getRepetitionIterationCount(currentRepetition) < currentRepetition.UserNumberOfRepetitions) {
                    this.doBackJump(currentRepetition);
                    this.backJumpOccurred = true;
                    return;
                }
            }
            if (repetitionInstruction === currentRepetition.forwardJumpInstruction) {
                if (
                  this.JumpResponsibleRepetition !== undefined
                  && currentRepetition !== this.JumpResponsibleRepetition
                  && currentRepetition.StartIndex >= this.JumpResponsibleRepetition.StartIndex
                  && currentRepetition.EndIndex <= this.JumpResponsibleRepetition.EndIndex
                ) {
                    this.resetRepetitionIterationCount(currentRepetition);
                }

                let forwardJumpTargetMeasureIndex: number = currentRepetition.getForwardJumpTargetForIteration(
                  this.getRepetitionIterationCount(currentRepetition)
                );
                if (forwardJumpTargetMeasureIndex >= 0) {
                    this.currentMeasureIndex = forwardJumpTargetMeasureIndex;
                    this.currentMeasure = this.manager.MusicSheet.SourceMeasures[this.currentMeasureIndex];
                    this.currentVoiceEntryIndex = -1;
                    this.jumpResponsibleRepetition = currentRepetition;
                    this.forwardJumpOccurred = true;
                    return;
                }
                if (forwardJumpTargetMeasureIndex === -2) {
                    this.endReached = true;
                }
            }
        }
        this.currentMeasureIndex++;
        if (this.JumpResponsibleRepetition !== undefined && this.currentMeasureIndex > this.JumpResponsibleRepetition.EndIndex) {
            this.jumpResponsibleRepetition = undefined;
        }
    }
    private doBackJump(currentRepetition: Repetition): void {
        this.currentMeasureIndex = currentRepetition.getBackwardJumpTarget();
        this.currentMeasure = this.manager.MusicSheet.SourceMeasures[this.currentMeasureIndex];
        this.currentVoiceEntryIndex = -1;
        this.incrementRepetitionIterationCount(currentRepetition);
        this.jumpResponsibleRepetition = currentRepetition;
    }
    private activateCurrentRhythmInstructions(): void {
        if (
          this.currentMeasure !== undefined &&
          this.currentMeasure.FirstInstructionsStaffEntries.length > 0 &&
          this.currentMeasure.FirstInstructionsStaffEntries[0] !== undefined
        ) {
            let instructions: AbstractNotationInstruction[] = this.currentMeasure.FirstInstructionsStaffEntries[0].Instructions;
            for (let idx: number = 0, len: number = instructions.length; idx < len; ++idx) {
                let abstractNotationInstruction: AbstractNotationInstruction = instructions[idx];
                if (abstractNotationInstruction instanceof RhythmInstruction) {
                    this.manager.MusicSheet.SheetPlaybackSetting.rhythm = (<RhythmInstruction>abstractNotationInstruction).Rhythm;
                }
            }
        }
    }
    private activateCurrentDynamicOrTempoInstructions(): void {
        let timeSortedDynamics: DynamicsContainer[] = this.manager.MusicSheet.TimestampSortedDynamicExpressionsList;
        while (
          this.currentDynamicEntryIndex > 0 && (
            this.currentDynamicEntryIndex >= timeSortedDynamics.length ||
            timeSortedDynamics[this.currentDynamicEntryIndex].parMultiExpression().AbsoluteTimestamp >= this.CurrentSourceTimestamp
          )
        ) {
            this.currentDynamicEntryIndex--;
        }
        while (
          this.currentDynamicEntryIndex < timeSortedDynamics.length &&
          timeSortedDynamics[this.currentDynamicEntryIndex].parMultiExpression().AbsoluteTimestamp < this.CurrentSourceTimestamp
        ) {
            this.currentDynamicEntryIndex++;
        }
        while (
          this.currentDynamicEntryIndex < timeSortedDynamics.length
          && timeSortedDynamics[this.currentDynamicEntryIndex].parMultiExpression().AbsoluteTimestamp === this.CurrentSourceTimestamp
        ) {
            let dynamicsContainer: DynamicsContainer = timeSortedDynamics[this.currentDynamicEntryIndex];
            let staffIndex: number = dynamicsContainer.staffNumber;
            if (this.CurrentSourceTimestamp === dynamicsContainer.parMultiExpression().AbsoluteTimestamp) {
                if (dynamicsContainer.continuousDynamicExpression !== undefined) {
                    this.activeDynamicExpressions[staffIndex] = dynamicsContainer.continuousDynamicExpression;
                } else if (dynamicsContainer.instantaneousDynamicExpression !== undefined) {
                    this.activeDynamicExpressions[staffIndex] = dynamicsContainer.instantaneousDynamicExpression;
                }
            }
            this.currentDynamicEntryIndex++;
        }
        this.currentDynamicChangingExpressions = [];
        for (let staffIndex: number = 0; staffIndex < this.activeDynamicExpressions.length; staffIndex++) {
            if (this.activeDynamicExpressions[staffIndex] !== undefined) {
                let startTime: Fraction;
                let endTime: Fraction;
                if (this.activeDynamicExpressions[staffIndex] instanceof ContinuousDynamicExpression) {
                    let continuousDynamic: ContinuousDynamicExpression = <ContinuousDynamicExpression>this.activeDynamicExpressions[staffIndex];
                    startTime = continuousDynamic.StartMultiExpression.AbsoluteTimestamp;
                    endTime = continuousDynamic.EndMultiExpression.AbsoluteTimestamp;
                    if (this.CurrentSourceTimestamp >= startTime && this.CurrentSourceTimestamp <= endTime) {
                        this.currentDynamicChangingExpressions.push(new DynamicsContainer(continuousDynamic, staffIndex));
                    }
                } else {
                    let instantaniousDynamic: InstantaniousDynamicExpression = <InstantaniousDynamicExpression>this.activeDynamicExpressions[staffIndex];
                    if (this.CurrentSourceTimestamp === instantaniousDynamic.ParentMultiExpression.AbsoluteTimestamp) {
                        this.currentDynamicChangingExpressions.push(new DynamicsContainer(instantaniousDynamic, staffIndex));
                    }
                }
            }
        }
        let timeSortedTempoExpressions: MultiTempoExpression[] = this.manager.MusicSheet.TimestampSortedTempoExpressionsList;

        while (this.currentTempoEntryIndex > 0 && (
          this.currentTempoEntryIndex >= timeSortedTempoExpressions.length
          || timeSortedTempoExpressions[this.currentTempoEntryIndex].AbsoluteTimestamp >= this.CurrentSourceTimestamp
        )) {
            this.currentTempoEntryIndex--;
        }

        while (
          this.currentTempoEntryIndex < timeSortedTempoExpressions.length &&
          timeSortedTempoExpressions[this.currentTempoEntryIndex].AbsoluteTimestamp < this.CurrentSourceTimestamp
        ) {
            this.currentTempoEntryIndex++;
        }

        while (
          this.currentTempoEntryIndex < timeSortedTempoExpressions.length
          && timeSortedTempoExpressions[this.currentTempoEntryIndex].AbsoluteTimestamp === this.CurrentSourceTimestamp
        ) {
            this.activeTempoExpression = timeSortedTempoExpressions[this.currentTempoEntryIndex];
            this.currentTempoEntryIndex++;
        }
        this.currentTempoChangingExpression = undefined;
        if (this.activeTempoExpression !== undefined) {
            let endTime: Fraction = this.activeTempoExpression.AbsoluteTimestamp;
            if (this.activeTempoExpression.ContinuousTempo !== undefined) {
                endTime = this.activeTempoExpression.ContinuousTempo.AbsoluteEndTimestamp;
            }
            if (   this.CurrentSourceTimestamp >= this.activeTempoExpression.AbsoluteTimestamp
                || this.CurrentSourceTimestamp <= endTime
            ) {
                this.currentTempoChangingExpression = this.activeTempoExpression;
            }
        }
    }
    private recursiveMove(): void {
        this.currentVoiceEntryIndex++;
        if (this.currentVoiceEntryIndex === 0) {
            this.handleRepetitionsAtMeasureBegin();
            this.activateCurrentRhythmInstructions();
        }
        if (this.currentVoiceEntryIndex >= 0 && this.currentVoiceEntryIndex < this.currentMeasure.VerticalSourceStaffEntryContainers.length) {
            let currentContainer: VerticalSourceStaffEntryContainer = this.currentMeasure.VerticalSourceStaffEntryContainers[this.currentVoiceEntryIndex];
            this.currentVoiceEntries = this.getVoiceEntries(currentContainer);
            this.currentVerticalContainerInMeasureTimestamp = currentContainer.Timestamp;
            this.currentTimeStamp = Fraction.plus(this.currentMeasure.AbsoluteTimestamp, this.currentVerticalContainerInMeasureTimestamp);
            if (this.currentTimeStamp >= this.manager.MusicSheet.SelectionEnd) {
                this.endReached = true;
            }
            this.activateCurrentDynamicOrTempoInstructions();
            return;
        }
        this.currentEnrolledMeasureTimestamp.Add(this.currentMeasure.Duration);
        this.handleRepetitionsAtMeasureEnd();
        if (this.currentMeasureIndex >= 0 && this.currentMeasureIndex < this.manager.MusicSheet.SourceMeasures.length) {
            this.currentMeasure = this.manager.MusicSheet.SourceMeasures[this.currentMeasureIndex];
            this.currentTimeStamp = Fraction.plus(this.currentMeasure.AbsoluteTimestamp, this.currentVerticalContainerInMeasureTimestamp);
            this.currentVoiceEntryIndex = -1;
            this.recursiveMove();
            return;
        }
        this.currentVerticalContainerInMeasureTimestamp = new Fraction();
        this.currentMeasure = undefined;
        this.currentVoiceEntries = undefined;
        this.endReached = true;
    }
    private checkEntries(notesOnly: boolean): boolean {
        let tlist: VoiceEntry[] = this.CurrentVisibleVoiceEntries();
        if (tlist.length > 0) {
            if (!notesOnly) { return true; }
            for (let idx: number = 0, len: number = tlist.length; idx < len; ++idx) {
                let entry: VoiceEntry = tlist[idx];
                if (entry.Notes[0].Pitch !== undefined) { return true; }
            }
        }
        return false;
    }
    private getVisibleEntries(entry: VoiceEntry, visibleEntries: VoiceEntry[]): void {
        if (entry.ParentVoice.Visible) {
            visibleEntries.push(entry);
        }
    }
    private getAudibleEntries(entry: VoiceEntry, audibleEntries: VoiceEntry[]): void {
        if (entry.ParentVoice.Audible) {
            audibleEntries.push(entry);
        }
    }
    private getScoreFollowingEntries(entry: VoiceEntry, followingEntries: VoiceEntry[]): void {
        if (entry.ParentVoice.Following && entry.ParentVoice.Parent.Following) {
            followingEntries.push(entry);
        }
    }
    private getVoiceEntries(container: VerticalSourceStaffEntryContainer): VoiceEntry[] {
        let entries: VoiceEntry[] = [];
        for (let sourceStaffEntry of container.StaffEntries) {
            if (sourceStaffEntry === undefined) { continue; }
            for (let voiceEntry of sourceStaffEntry.VoiceEntries) {
                entries.push(voiceEntry);
            }
        }
        return entries;
    }


}