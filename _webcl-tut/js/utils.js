define(
    ["jquery"],
    (function ($) {
        "use strict";

        function webClInfo() {
            if (window.WebCL === undefined) {
                alert("Unfortunately your system does not support WebCL. " +
                    "Make sure that you have both the OpenCL driver " +
                    "and the WebCL browser extension installed.");
                return;
            }

            try {
                var platforms = WebCL.getPlatformIDs(), // API: Get the list of available platforms.
                    devices = [],
                    i;

                for (i = 0; i < platforms.length; i += 1) {
                    var platform = platforms[i];
                    devices[i] = platform.getDeviceIDs(WebCL.CL_DEVICE_TYPE_ALL); // API: Obtain the list of devices
                    // available on a platform.
                }

                log(devices);

            } catch (e) {
                alert("Unfortunately platform or device inquiry failed.");
            }
        }

        /**
         * Returns the kernel source code.
         * @param id
         * @return {*}
         */
        function loadKernel(id) {
            var kernelElement = document.getElementById(id), // TODO vermutlich ist jQuery zu langsam?
                kernelSource = kernelElement.text;

            if (kernelElement.src != "") {
                var mHttpReq = new XMLHttpRequest();
                mHttpReq.open("GET", kernelElement.src, false);
                mHttpReq.send(null);
                kernelSource = mHttpReq.responseText;
            }
            return kernelSource;
        }

        /**
         *
         * @param context
         * @param UIvec1
         * @param UIvec2
         * @param vectorLength
         * @return {*|null|String}
         * @constructor
         */
        function CL_vectorAdd(context, UIvec1, UIvec2, vectorLength) {
            var bufSize = 0,
                bufIn1 = null,
                bufIn2 = null,
                bufOut = null,
                bufRes = null,
                kernelSrc = null,
                program = null,
                devices = null,
                kernel = null,
                cmdQueue = null,
                localWS = null,
                globalWS = null;

            try {
                // Reserve buffers
                bufSize = vectorLength * 4; // for UINT got 4 byte
                bufIn1 = context.createBuffer(WebCL.CL_MEM_READ_ONLY, bufSize);
                bufIn2 = context.createBuffer(WebCL.CL_MEM_READ_ONLY, bufSize);
                bufOut = context.createBuffer(WebCL.CL_MEM_WRITE_ONLY, bufSize);

                log("Buffer size: " + bufSize + " bytes");

                // Create and build program for the first device
                kernelSrc = loadKernel("clProgramVectorAdd");
                program = context.createProgramWithSource(kernelSrc);
                devices = context.getContextInfo(WebCL.CL_CONTEXT_DEVICES);
                program.buildProgram([devices[0]], ""); // TODO throws what?

                // Create kernel and set arguments
                kernel = program.createKernel("ckVectorAdd");
                kernel.setKernelArg(0, bufIn1);
                kernel.setKernelArg(1, bufIn2);
                kernel.setKernelArg(2, bufOut);
                kernel.setKernelArg(3, vectorLength, WebCL.types.UINT);

                // Create command queue using the first available device
                cmdQueue = context.createCommandQueue(devices[0], 0);

                // Write the buffer to OpenCL device memory
                cmdQueue.enqueueWriteBuffer(bufIn1, false, 0, bufSize, UIvec1, []);
                cmdQueue.enqueueWriteBuffer(bufIn2, false, 0, bufSize, UIvec2, []);

                // Init ND-range
                localWS = [8];
                globalWS = [Math.ceil(vectorLength / localWS) * localWS];

                log("Global work item size: " + globalWS);
                log("Local work item size: " + localWS);

                // Execute (enqueue) kernel
                cmdQueue.enqueueNDRangeKernel(kernel, globalWS.length, [], globalWS, localWS, []);

                // Read the result buffer from OpenCL device
                bufRes = new Uint32Array(vectorLength);
                cmdQueue.enqueueReadBuffer(bufOut, false, 0, bufSize, bufRes, []);
                cmdQueue.finish(); // Finish all the operations

                return bufRes;

            } catch (e) {
                return e.message + "\n" +
                    program.getProgramBuildInfo(devices[0], WebCL.CL_PROGRAM_BUILD_STATUS) + ":  " +
                    program.getProgramBuildInfo(devices[0], WebCL.CL_PROGRAM_BUILD_LOG);
            }
        }

        return {
            "webClInfo": webClInfo,
            "CL_vectorAdd": CL_vectorAdd
        }
    })
);