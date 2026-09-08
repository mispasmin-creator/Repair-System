import React, { useEffect, useState } from "react";
import { Plus, X, Upload, Loader2Icon } from "lucide-react";
import Button from "../ui/Button";
import SearchableSelect from "../ui/SearchableSelect";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const IndentForm = ({ onSubmit, onCancel, taskList }) => {
  const { user } = useAuth();
  const [sheetData, setSheetData] = useState([]);
  const [doerName, setDoerName] = useState([]);
  const [giveByData, setGivenByData] = useState([]);
  const [taskStatusData, setTaskStatusData] = useState([]);
  const [priorityData, setPriorityData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [uomData, setUomData] = useState([]);
  const [firmNameData, setFirmNameData] = useState([]);
  const [machineNameMasterData, setMachineNameMasterData] = useState([]);

  const [selectedMachine, setSelectedMachine] = useState("");
  const [filteredSerials, setFilteredSerials] = useState([]);
  const [filteredDepartment, setFilteredDepartment] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [machineLocation, setMachineLocation] = useState([]);
  const [location, setLocation] = useState("");
  const [userManualFile, setUserManualFile] = useState(null);
  const [machinePartName, setMachinePartName] = useState("");

  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTaskDate, setEndTaskDate] = useState("");
  const [availableFrequencies, setAvailableFrequencies] = useState([]);

  const [selectedSerialNo, setSelectedSerialNo] = useState("");
  const [selectedFirmName, setSelectedFirmName] = useState("");

  useEffect(() => {
    if (user?.firmName && user.firmName.toLowerCase() !== "all") {
      setSelectedFirmName(user.firmName);
    }
  }, [user]);
  const [selectedGivenBy, setSelectedGivenBy] = useState("");
  const [selectedDoerName, setSelectedDoerName] = useState("");
  const [selectedTaskType, setSelectedTaskType] = useState("Select Task Type");
  const [needSoundTask, setNeedSoundTask] = useState("");
  const [temperature, setTemperature] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [description, setPromblemInMachine] = useState("");
  const [machineArea, setMachineArea] = useState("");
  const [partName, setPartName] = useState("");
  const [uom, setUom] = useState("");
  const [quantity, setQuantity] = useState("");

  // "Add New" toggles for dropdowns that should also accept a custom typed value
  const [isAddingMachine, setIsAddingMachine] = useState(false);
  const [isAddingSerial, setIsAddingSerial] = useState(false);
  const [isAddingDoer, setIsAddingDoer] = useState(false);
  const [isAddingGivenBy, setIsAddingGivenBy] = useState(false);
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [isAddingPriority, setIsAddingPriority] = useState(false);
  const [isAddingUom, setIsAddingUom] = useState(false);
  const [isAddingFirmName, setIsAddingFirmName] = useState(false);

  const [loaderSheetData, setLoaderSheetData] = useState(false);
  const [loaderSubmit, setLoaderSubmit] = useState(false);
  const [loaderMasterSheetData, setLoaderMasterSheetData] = useState(false);

  const [enableReminder, setEnableReminder] = useState(false);
  const [requireAttachment, setRequireAttachment] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Updated URLs and IDs for data fetching (Maintenance)
  const DATA_FETCH_SCRIPT_URL = import.meta.env.VITE_DATA_FETCH_SCRIPT_URL;
  const DATA_SHEET_ID = import.meta.env.VITE_DATA_SHEET_ID;

  // URLs and IDs for data submission(Repair System)
  const SUBMIT_SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SUBMIT_SHEET_ID = import.meta.env.VITE_SHEET_ID;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

  const fetchSheetData = async () => {
    if (!DATA_FETCH_SCRIPT_URL || !DATA_SHEET_ID) return;
    try {
      setLoaderSheetData(true);
      // Use getRepairTasks action — it already handles Repair System sheet (row 6 headers)
      const res = await fetch(
        `${DATA_FETCH_SCRIPT_URL}?action=getRepairTasks&sheetId=${DATA_SHEET_ID}`
      );
      const result = await res.json();

      if (result.success && result.data) {
        setSheetData(result.data);
      } else {
        console.warn("fetchSheetData (getRepairTasks):", result.error || result.message);
      }
    } catch (err) {
      console.warn("fetchSheetData error:", err);
    } finally {
      setLoaderSheetData(false);
    }
  };

  const fetchMasterSheetData = async () => {
    if (!DATA_FETCH_SCRIPT_URL || !DATA_SHEET_ID) return;
    const SHEET_NAME = "Master";
    try {
      setLoaderMasterSheetData(true);
      const res = await fetch(
        `${DATA_FETCH_SCRIPT_URL}?sheetId=${DATA_SHEET_ID}&sheet=${SHEET_NAME}`
      );
      const result = await res.json();

      if (result.success && result.table) {
        const headers = (result.table.cols || []).map((col) => (col.label || "").toString().trim());
        const rows = result.table.rows || [];

        // Helper to find column index by potential names or fallback index
        const findColIndex = (possibleNames, fallbackIndex) => {
          const idx = headers.findIndex((h) => {
            const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
            return possibleNames.some((p) => clean.includes(p.toLowerCase().replace(/[^a-z0-9]/g, "")));
          });
          return idx !== -1 ? idx : fallbackIndex;
        };

        const indentorColIdx = findColIndex(["Indentor Name", "Indentor", "Doer Name", "Doer"], 0);
        const authColIdx = findColIndex(["Authorized Name", "Authorized", "Given By"], 1);
        const machineColIdx = findColIndex(["Machine Name", "Machine"], 2);
        const deptColIdx = findColIndex(["Department", "Dept"], 3);
        const uomColIdx = findColIndex(["UOM", "Unit"], 4);
        const firmColIdx = findColIndex(["Firm Name", "Firm"], 5);
        const priorityColIdx = findColIndex(["Priority"], -1);
        const taskStatusColIdx = findColIndex(["Task Status", "Status"], -1);

        const getColValues = (colIdx) => {
          if (colIdx === -1 || colIdx === undefined) return [];
          const seen = new Set();
          const list = [];
          rows.forEach((rowObj) => {
            const cell = rowObj.c && rowObj.c[colIdx];
            if (cell && cell.v !== null && cell.v !== undefined) {
              const val = cell.v.toString().trim();
              if (val && !seen.has(val.toLowerCase())) {
                seen.add(val.toLowerCase());
                list.push(val);
              }
            }
          });
          return list;
        };

        const sortAlpha = (list) =>
          [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));

        const indentorList = sortAlpha(getColValues(indentorColIdx));
        const authList = sortAlpha(getColValues(authColIdx));
        const machineList = sortAlpha(getColValues(machineColIdx));
        const deptList = sortAlpha(getColValues(deptColIdx));
        const uomList = sortAlpha(getColValues(uomColIdx));
        const firmList = sortAlpha(getColValues(firmColIdx));

        setDoerName(indentorList);
        setGivenByData(authList);
        setMachineNameMasterData(machineList);
        setDepartmentData(deptList);
        setUomData(uomList);
        setFirmNameData(firmList);

        if (priorityColIdx !== -1) {
          const priList = getColValues(priorityColIdx);
          if (priList.length > 0) setPriorityData(sortAlpha(priList));
        }
        if (taskStatusColIdx !== -1) {
          setTaskStatusData(sortAlpha(getColValues(taskStatusColIdx)));
        }
      } else {
        console.error("Server error:", result.message || result.error);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoaderMasterSheetData(false);
    }
  };

  useEffect(() => {
    if (taskList && taskList.length > 0) {
      setSheetData(taskList);
    }
    fetchSheetData();
    fetchMasterSheetData();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffInDays = (end - start) / (1000 * 60 * 60 * 24);

      let frequencies = [];
      if (diffInDays >= 365) {
        frequencies = [
          "one-time",
          "Daily",
          "Weekly",
          "Monthly",
          "Quarterly",
          "Half Yearly",
          "Yearly",
        ];
      } else if (diffInDays >= 180) {
        frequencies = [
          "one-time",
          "Daily",
          "Weekly",
          "Monthly",
          "Quarterly",
          "Half Yearly",
        ];
      } else if (diffInDays >= 90) {
        frequencies = ["one-time", "Daily", "Weekly", "Monthly", "Quarterly"];
      } else if (diffInDays >= 30) {
        frequencies = ["one-time", "Daily", "Weekly", "Monthly"];
      } else if (diffInDays >= 7) {
        frequencies = ["one-time", "Daily", "Weekly"];
      } else if (diffInDays > 0) {
        frequencies = ["one-time", "Daily"];
      }

      setAvailableFrequencies(frequencies);
    } else {
      setAvailableFrequencies([]);
    }
  }, [startDate, endDate]);

  const uploadFileToDrive = async (file) => {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        const base64Data = reader.result;

        try {
          const res = await fetch(SUBMIT_SCRIPT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              action: "uploadFile",
              base64Data: base64Data,
              fileName: file.name,
              mimeType: file.type || "image/jpeg",
              folderId: FOLDER_ID,
            }).toString(),
          });

          const data = await res.json();

          console.log("FileUploadData:", data);

          if (data.success && data.fileUrl) {
            resolve(data.fileUrl);
          } else {
            console.error("File upload response error:", data);
            toast.error("❌ Image upload issue: " + (data.error || "Google Drive file permission"));
            resolve(data.fileUrl || "");
          }
        } catch (err) {
          console.error("Upload error:", err);
          toast.error("❌ Upload failed due to network error");
          resolve("");
        }
      };

      reader.onerror = () => {
        reject("❌ Failed to read file");
      };

      reader.readAsDataURL(file);
    });
  };

  const clearFormState = () => {
    setSelectedSerialNo("");
    setSelectedMachine("");
    setSelectedFirmName("");
    setSelectedGivenBy("");
    setSelectedDoerName("");
    setSelectedTaskType("Select Task Type");
    setStartDate("");
    setEndDate("");
    setEndTaskDate("");
    setStartTime("");
    setEndTime("");
    setPromblemInMachine("");
    setSelectedPriority("");
    setMachinePartName("");
    setLocation("");
    setMachineArea("");
    setPartName("");
    setUom("");
    setQuantity("");
    setNeedSoundTask("");
    setTemperature("");
    setEnableReminder(false);
    setRequireAttachment(false);
    setUserManualFile(null);
    setFilteredSerials([]);
    setSelectedDepartment("");
    setIsAddingMachine(false);
    setIsAddingSerial(false);
    setIsAddingDoer(false);
    setIsAddingGivenBy(false);
    setIsAddingDepartment(false);
    setIsAddingPriority(false);
    setIsAddingUom(false);
    setIsAddingFirmName(false);
  };

  const handleMachineSelect = (selected) => {
    setSelectedMachine(selected);

    if (!selected) {
      setFilteredSerials([]);
      setSelectedSerialNo("");
      return;
    }

    const allSourceTasks = [...sheetData, ...(taskList || [])];
    const matched = allSourceTasks
      .filter((item) => (item["Machine Name"] || item.machineName) === selected)
      .map((item) => item["Serial No"] || item.serialNo)
      .filter(Boolean);

    let serials = [...new Set(matched)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
    );

    if (serials.length === 0 && selected) {
      const parts = selected.split("/");
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        if (lastPart) {
          serials.push(lastPart);
        }
      }
      serials.push(selected);
      serials = [...new Set(serials)].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
      );
    }

    setFilteredSerials(serials);
    if (serials.length === 1) {
      setSelectedSerialNo(serials[0]);
      handleSerialSelect(serials[0]);
    } else {
      setSelectedSerialNo("");
    }
  };

  const handleAddNewMachine = () => {
    setIsAddingMachine(true);
    setSelectedMachine("");
    setFilteredSerials([]);
    setIsAddingSerial(false);
    setSelectedSerialNo("");
  };

  const handleChooseMachineFromList = () => {
    setIsAddingMachine(false);
    setSelectedMachine("");
    setFilteredSerials([]);
    setIsAddingSerial(false);
    setSelectedSerialNo("");
  };

  const handleSerialSelect = (val) => {
    setSelectedSerialNo(val);
    if (!val) return;

    const allSourceTasks = [...sheetData, ...(taskList || [])];
    const found = allSourceTasks.find(
      (item) => (item["Serial No"] || item.serialNo) === val
    );
    if (found) {
      if (found["Department"] || found.department) {
        setSelectedDepartment(found["Department"] || found.department);
      }
      if (found["Location"] || found.location) {
        setLocation(found["Location"] || found.location);
      }
    }
  };

  const handleAddNewSerial = () => {
    setIsAddingSerial(true);
    setSelectedSerialNo("");
  };

  const handleChooseSerialFromList = () => {
    setIsAddingSerial(false);
    setSelectedSerialNo("");
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!selectedMachine || !selectedSerialNo || !selectedDoerName || !selectedGivenBy || !selectedFirmName) {
      toast.error("❌ Please fill in all required fields");
      return;
    }

    try {
      setLoaderSubmit(true);

      // Upload file first if exists
      let userManualUrl = "";
      if (userManualFile) {
        userManualUrl = await uploadFileToDrive(userManualFile);
      }

      const formPayload = new FormData();
      formPayload.append("sheetName", "Repair System");

      // For Repair tasks, send as single insert
      formPayload.append("action", "insert1");

      // Prepare single task data without generating task number
      const taskData = {
        "Time Stemp": new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
        "Serial No": selectedSerialNo,
        "Machine Name": selectedMachine,
        "Firm Name": selectedFirmName,
        "Given By": selectedGivenBy,
        "Authorized Name": selectedGivenBy,
        "Authorized By": selectedGivenBy,
        "Doer Name": selectedDoerName,
        "Doer's Name": selectedDoerName,
        "Indentor Name": selectedDoerName,
        "Indentor's Name": selectedDoerName,
        "Enable Reminders": enableReminder ? "Yes" : "No",
        "Require Attachment": requireAttachment ? "Yes" : "No",
        "Task Start Date": `${startDate} ${startTime}:00`,
        "Task Ending Date": `${endTaskDate} ${endTime}:00`,
        "Problem With Machine": description,
        Department: selectedDepartment,
        Location: location,
        "Machine Part Name": machinePartName,
        "Image Link": userManualUrl || "link not available",
        "Machine Image": userManualUrl || "link not available",
        "Image of the Machine": userManualUrl || "link not available",
        Priority: selectedPriority,
        UOM: uom,
        Quantity: quantity,
      };

      // Append all fields individually to formData
      Object.entries(taskData).forEach(([key, value]) => {
        formPayload.append(key, value);
      });

      // Submit to the correct sheet URL
      const response = await fetch(`${SUBMIT_SCRIPT_URL}?headerRow=5`, {
        method: "POST",
        body: formPayload,
      });

      const result = await response.json();
      
      if (result.success || response.ok) {
        toast.success("✅ Task assigned successfully!");

        // ✅ If user added a NEW machine name, save it to Master sheet silently
        if (isAddingMachine && selectedMachine && DATA_FETCH_SCRIPT_URL && DATA_SHEET_ID) {
          try {
            await fetch(SUBMIT_SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                action: "addToMaster",
                sheetName: "Master",
                sheetId: DATA_SHEET_ID,
                columnName: "Machine Name",
                value: selectedMachine,
              }).toString(),
            });
            // Refresh master data so dropdown shows new machine next time
            fetchMasterSheetData();
          } catch (masterErr) {
            console.warn("Could not save machine to Master sheet:", masterErr);
          }
        }

        // Clear form state
        clearFormState();
        
        // Call onSubmit to refresh the parent component's data
        if (onSubmit) {
          onSubmit();
        }
        
        // Close modal
        onCancel();
      } else {
        throw new Error(result.message || "Submission failed");
      }

    } catch (error) {
      console.error("❌ Submission failed:", error);
      toast.error("❌ Something went wrong during submission.");
    } finally {
      setLoaderSubmit(false);
    }
  };

  return (
    <form onSubmit={handleSubmitForm} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Machine Name Dropdown */}
        <SearchableSelect
          id="machineName"
          label="Machine Name *"
          required
          value={selectedMachine}
          onChange={setSelectedMachine}
          onOptionSelect={handleMachineSelect}
          options={machineNameMasterData}
          loading={loaderMasterSheetData}
          isAdding={isAddingMachine}
          setIsAdding={setIsAddingMachine}
          onAddNew={handleAddNewMachine}
          onChooseFromList={handleChooseMachineFromList}
        />

        {/* Firm Name */}
        {user?.firmName && user.firmName.toLowerCase() !== "all" ? (
          <div>
            <label htmlFor="firmName" className="block text-sm font-medium text-gray-700 mb-1">
              Firm Name *
            </label>
            <input
              type="text"
              id="firmName"
              value={selectedFirmName}
              readOnly
              className="py-2 w-full rounded-md border border-gray-300 shadow-sm px-4 bg-gray-100 cursor-not-allowed focus:outline-none text-sm"
            />
          </div>
        ) : (
          <SearchableSelect
            id="firmName"
            label="Firm Name *"
            required
            value={selectedFirmName}
            onChange={setSelectedFirmName}
            options={firmNameData}
            loading={loaderMasterSheetData}
            isAdding={isAddingFirmName}
            setIsAdding={setIsAddingFirmName}
          />
        )}

        {/* Serial No Related to Machine Name */}
        {(selectedMachine || isAddingMachine) && !loaderSheetData && (
          <SearchableSelect
            id="serialNo"
            label="Serial Number *"
            required
            value={selectedSerialNo}
            onChange={setSelectedSerialNo}
            onOptionSelect={handleSerialSelect}
            options={filteredSerials}
            isAdding={isAddingMachine || isAddingSerial}
            setIsAdding={setIsAddingSerial}
            disableChooseFromList={isAddingMachine}
            onAddNew={handleAddNewSerial}
            onChooseFromList={handleChooseSerialFromList}
            autoFocusOnAdd={!isAddingMachine}
          />
        )}

        {/* Indentor Name */}
        <SearchableSelect
          id="doerName"
          label="Indentor Name *"
          required
          value={selectedDoerName}
          onChange={setSelectedDoerName}
          options={doerName}
          loading={loaderMasterSheetData}
          isAdding={isAddingDoer}
          setIsAdding={setIsAddingDoer}
        />

        {/* Authorized Name */}
        <SearchableSelect
          id="givenBy"
          label="Authorized Name *"
          required
          value={selectedGivenBy}
          onChange={setSelectedGivenBy}
          options={giveByData}
          loading={loaderMasterSheetData}
          isAdding={isAddingGivenBy}
          setIsAdding={setIsAddingGivenBy}
        />

        {/* Department */}
        <SearchableSelect
          id="department"
          label="Department"
          value={selectedDepartment}
          onChange={setSelectedDepartment}
          options={departmentData}
          loading={loaderMasterSheetData}
          isAdding={isAddingDepartment}
          setIsAdding={setIsAddingDepartment}
        />

        {/* Machine Part Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Machine Part Name
          </label>
          <input
            type="text"
            name="machinePartName"
            value={machinePartName}
            onChange={(e) => setMachinePartName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
          />
        </div>

        {/* UOM */}
        <SearchableSelect
          id="uom"
          label="UOM"
          value={uom}
          onChange={setUom}
          options={uomData}
          loading={loaderMasterSheetData}
          isAdding={isAddingUom}
          setIsAdding={setIsAddingUom}
        />

        {/* Quantity */}
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
            Quantity
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter Quantity"
            min="0"
            step="any"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
          />
        </div>

        {/* Priority */}
        <SearchableSelect
          id="priority"
          label="Priority"
          value={selectedPriority}
          onChange={setSelectedPriority}
          options={priorityData.length > 0 ? priorityData : ["Critical", "High", "Low", "Medium"]}
          loading={loaderMasterSheetData}
          isAdding={isAddingPriority}
          setIsAdding={setIsAddingPriority}
        />

        {/* Start Date */}
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Task Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm p-2 bg-white"
          />
        </div>

        {/* Task Start Time */}
        <div>
          <label
            htmlFor="startTime"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Task Start Time
          </label>
          <input
            type="time"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm p-2 bg-white"
          />
        </div>

        {/* End Date */}
        <div>
          <label
            htmlFor="endTaskDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Task End Date
          </label>
          <input
            type="date"
            id="endTaskDate"
            value={endTaskDate}
            onChange={(e) => setEndTaskDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm p-2 bg-white"
          />
        </div>

        {/* Task End Time */}
        <div>
          <label
            htmlFor="endTime"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Task End Time
          </label>
          <input
            type="time"
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm p-2 bg-white"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Problem With Machine
        </label>
        <textarea
          id="description"
          onChange={(e) => setPromblemInMachine(e.target.value)}
          value={description}
          rows={4}
          className="w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Enter Machine Problem..."
        />
      </div>

      {/* Location */}
      <div>
        <label
          htmlFor="location"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Location
        </label>
        <input
          type="text"
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Enter location"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
        />
      </div>

      {/* upload Image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image of the Machine
        </label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors duration-200 bg-white">
          <div className="space-y-1 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="flex text-sm text-gray-600">
              <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                <span>Upload a file</span>
                <input
                  type="file"
                  name="imageOfTheMachine"
                  onChange={(e) => setUserManualFile(e.target.files[0])}
                  className="sr-only"
                  accept="image/*"
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            {userManualFile && (
              <p className="text-sm text-green-600 mt-2">
                Selected: {userManualFile.name}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            name="enableReminders"
            checked={enableReminder}
            onChange={() => setEnableReminder((prev) => !prev)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Enable Reminders</span>
        </label>

        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            name="requireAttachment"
            checked={requireAttachment}
            onChange={() => setRequireAttachment((prev) => !prev)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Require Attachment</span>
        </label>
      </div>

      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={loaderSubmit}>
          {loaderSubmit && <Loader2Icon className="animate-spin mr-2" />}
          Save Indent
        </Button>
      </div>
    </form>
  );
};

export default IndentForm;