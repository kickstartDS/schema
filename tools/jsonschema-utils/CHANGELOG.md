# Change Log - @kickstartds/jsonschema-utils

This log was last generated on Fri, 04 Jul 2025 20:35:48 GMT and should not be manually modified.

## 3.6.1
Fri, 04 Jul 2025 20:35:48 GMT

### Patches

- dont hide fields by default

## 3.6.0
Fri, 04 Jul 2025 15:47:19 GMT

### Minor changes

- implement feature to hide hidden fields in generated config

## 3.5.0
Wed, 02 Jul 2025 09:04:33 GMT

### Minor changes

- add default object for schema function

## 3.4.3
Fri, 25 Oct 2024 07:12:38 GMT

### Patches

- add preview cms annotation

## 3.4.2
Mon, 30 Sep 2024 11:39:44 GMT

### Patches

- add additional cms format, add table format

## 3.4.1
Wed, 11 Sep 2024 12:34:08 GMT

### Patches

- export deepMerge

## 3.4.0
Tue, 20 Aug 2024 13:12:42 GMT

### Minor changes

- add cms layering

## 3.3.3
Wed, 10 Jul 2024 12:46:32 GMT

### Patches

- handle nested allOfs

## 3.3.2
Tue, 09 Jul 2024 11:13:35 GMT

### Patches

- trigger release

## 3.3.1
Tue, 09 Jul 2024 10:38:59 GMT

### Patches

- add inlining cms flag to allowed keywords

## 3.3.0
Fri, 05 Jul 2024 14:49:28 GMT

### Minor changes

- allow additional cms related keywords

## 3.2.0
Fri, 28 Jun 2024 15:41:21 GMT

### Minor changes

- handle title fields in JSON Schemas

## 3.1.2
Tue, 25 Jun 2024 10:40:59 GMT

### Patches

- trigger another version with build included

## 3.1.1
Tue, 25 Jun 2024 10:33:43 GMT

### Patches

- revert not respecting content module by default

## 3.1.0
Tue, 25 Jun 2024 09:46:26 GMT

### Minor changes

- add icon format handling

## 3.0.16
Mon, 24 Jun 2024 10:40:19 GMT

### Patches

- dont reference content module

## 3.0.15
Wed, 17 Apr 2024 18:29:14 GMT

### Patches

- don't deep merge processing configuration

## 3.0.14
Wed, 17 Apr 2024 13:59:54 GMT

### Patches

- option to replace examples, instead of mergin. on by default

## 3.0.13
Mon, 15 Apr 2024 13:24:51 GMT

### Patches

- release trigger

## 3.0.12
Mon, 15 Apr 2024 13:21:12 GMT

### Patches

- fix type resolution in inlining

## 3.0.11
Wed, 20 Mar 2024 20:13:09 GMT

### Patches

- add typed versions of getEdge, getVertex in graph

## 3.0.10
Wed, 20 Mar 2024 14:13:07 GMT

### Patches

- add exports for new graph types

## 3.0.9
Mon, 18 Mar 2024 16:21:34 GMT

### Patches

- trigger another fixed release

## 3.0.8
Mon, 18 Mar 2024 16:16:53 GMT

### Patches

- add vertices before trying to add them to an edge

## 3.0.7
Mon, 18 Mar 2024 15:09:15 GMT

### Patches

- fix refTarget in schema graph

## 3.0.6
Mon, 18 Mar 2024 13:53:57 GMT

### Patches

- update graph generation

## 3.0.5
Mon, 18 Mar 2024 10:56:30 GMT

### Patches

- add edge data to schema graph

## 3.0.4
Thu, 14 Mar 2024 14:00:48 GMT

### Patches

- change logging

## 3.0.3
Thu, 14 Mar 2024 13:50:59 GMT

### Patches

- add option to create new subgraph vom vertex id

## 3.0.2
Thu, 14 Mar 2024 13:15:38 GMT

### Patches

- clean up schema graph function parameters

## 3.0.1
Thu, 14 Mar 2024 12:45:31 GMT

### Patches

- add option to pass graph to schema sort

## 3.0.0
Thu, 14 Mar 2024 12:11:35 GMT

### Breaking changes

- update to new kickstartDS releases

### Patches

- switch graph implementation

## 2.12.1
Tue, 23 Jan 2024 10:56:23 GMT

### Patches

- clean up ksDS dependencies

## 2.12.0
Fri, 19 Jan 2024 10:59:21 GMT

### Minor changes

- streamline result processing in reducer, update error handling

## 2.11.1
Mon, 15 Jan 2024 13:01:48 GMT

### Patches

- handle type properties in inline references correctly

## 2.11.0
Wed, 10 Jan 2024 08:06:43 GMT

### Minor changes

- fix array check, further streamline reducer

## 2.10.0
Mon, 04 Dec 2023 11:43:19 GMT

### Minor changes

- remove lodash and ramda

## 2.9.0
Thu, 23 Nov 2023 21:05:30 GMT

### Minor changes

- rework reducer

## 2.8.0
Sun, 29 Oct 2023 11:05:45 GMT

### Minor changes

- Also inline $ref pointer in allOfs

## 2.7.1
Thu, 26 Oct 2023 21:26:21 GMT

### Patches

- fix return type on dereference task

## 2.7.0
Tue, 17 Oct 2023 20:29:19 GMT

### Minor changes

- Create schema dependency graph, and sort for processing

## 2.6.0
Sun, 15 Oct 2023 10:08:47 GMT

### Minor changes

- Adds processing options for additionalProperties handling

### Patches

- Add processing options interface
- Add additional processing flags

## 2.5.2
Thu, 12 Oct 2023 12:44:39 GMT

### Patches

- rename reducer on filesystem

## 2.5.1
Wed, 11 Oct 2023 11:51:20 GMT

### Patches

- update to next release of kickstartDS

## 2.5.0
Sat, 07 Oct 2023 18:54:59 GMT

### Minor changes

- add modules option to schema processing fns

## 2.4.18
Fri, 06 Oct 2023 13:43:55 GMT

### Patches

- fix naming of generated interface schemas

## 2.4.17
Fri, 06 Oct 2023 13:08:52 GMT

### Patches

- cleans up inlineDefinitions function

## 2.4.16
Thu, 05 Oct 2023 10:51:41 GMT

### Patches

- handle more array cases in reducer

## 2.4.15
Tue, 03 Oct 2023 13:03:14 GMT

### Patches

- bump version, trigger release

## 2.4.14
Tue, 03 Oct 2023 12:46:28 GMT

### Patches

- loading of interfaces, only load installed modules

## 2.4.13
Mon, 02 Oct 2023 09:50:58 GMT

### Patches

- added dereferencing command for JSON Schema

## 2.4.12
Mon, 25 Sep 2023 14:22:48 GMT

### Patches

- added resources folder to published files

## 2.4.11
Mon, 25 Sep 2023 13:21:10 GMT

### Patches

- moved dependencies to be installed when used

## 2.4.10
Sun, 24 Sep 2023 13:58:19 GMT

### Patches

- fix layering, add some utility functions

